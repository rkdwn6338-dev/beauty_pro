import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types";
export class GenerationRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export type GenerationIntent = {
  requestId: string;
  projectId: string;
  productId: string;
  agencyId: string;
  userId: string;
  operation: "generate" | "regenerate_section";
  baseId: string | null;
  sectionId?: string;
  instruction?: string;
};
export const generationGuardEnabled = () =>
  process.env.ENABLE_GENERATION_GUARD === "true";
export const generationHash = (input: GenerationIntent) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        user: input.userId,
        project: input.projectId,
        product: input.productId,
        operation: input.operation,
        base: input.baseId,
        section: input.sectionId ?? null,
        instruction: input.instruction?.trim() ?? "",
      }),
    )
    .digest("hex");
export const MAX_PLANNING_INPUT_BYTES = 65536;
export function boundedPlanningInput(input: unknown): string {
  const text = JSON.stringify(input);
  if (Buffer.byteLength(text, "utf8") > MAX_PLANNING_INPUT_BYTES)
    throw new GenerationRequestError(
      "기획 입력량 한도를 초과했습니다. 필요한 근거를 추린 뒤 다시 요청해 주세요.",
      413,
    );
  return text;
}
export async function findGeneration(
  client: SupabaseClient<Database>,
  input: GenerationIntent,
) {
  if (!generationGuardEnabled())
    throw new GenerationRequestError(
      "AI 요청 보호 장치를 연결하고 있습니다.",
      503,
    );
  const { data, error } = await client
    .from("planning_generation_requests")
    .select("*")
    .eq("id", input.requestId)
    .eq("project_id", input.projectId)
    .eq("product_id", input.productId)
    .eq("requested_by", input.userId)
    .maybeSingle();
  if (error)
    throw new GenerationRequestError(
      "기존 AI 요청 상태를 확인하지 못했습니다. AI를 다시 호출하지 않았습니다.",
      503,
    );
  if (!data) return null;
  if (data.input_hash !== generationHash(input))
    throw new GenerationRequestError(
      "동일한 요청 번호로 다른 내용을 보낼 수 없습니다.",
      409,
    );
  if (data.status === "completed" && data.result_version_id) {
    const result = await client
      .from("planning_versions")
      .select("*")
      .eq("id", data.result_version_id)
      .eq("project_id", input.projectId)
      .eq("product_id", input.productId)
      .maybeSingle();
    if (result.error || !result.data)
      throw new GenerationRequestError(
        "저장된 생성 결과를 불러오지 못했습니다. AI를 다시 호출하지 않았습니다.",
        503,
      );
    return result.data;
  }
  throw new GenerationRequestError(
    data.status === "running"
      ? "같은 요청을 처리 중입니다. 최신 버전을 확인해 주세요. AI를 중복 호출하지 않았습니다."
      : "이 요청은 중단되었거나 만료됐습니다. 최신 버전을 확인한 뒤 새 요청으로 시작해 주세요.",
    409,
  );
}
export async function reserveGeneration(
  client: SupabaseClient<Database>,
  input: GenerationIntent,
  model: string,
) {
  if (!generationGuardEnabled())
    throw new GenerationRequestError(
      "AI 요청 보호 장치를 연결하고 있습니다.",
      503,
    );
  const { error: expireError } = await client
    .from("planning_generation_requests")
    .update({ status: "expired", error_message: "처리 확인 제한 시간 초과" })
    .eq("product_id", input.productId)
    .eq("project_id", input.projectId)
    .eq("status", "running")
    .lt("expires_at", new Date().toISOString());
  if (expireError)
    throw new GenerationRequestError(
      "이전 요청 상태를 확인하지 못했습니다. AI를 호출하지 않았습니다.",
      503,
    );
  const { error } = await client.from("planning_generation_requests").insert({
    id: input.requestId,
    agency_id: input.agencyId,
    project_id: input.projectId,
    product_id: input.productId,
    requested_by: input.userId,
    operation: input.operation,
    base_version_id: input.baseId,
    section_id: input.sectionId ?? null,
    input_hash: generationHash(input),
    model,
    status: "running",
  });
  if (error)
    throw new GenerationRequestError(
      error.code === "P0001"
        ? "오늘 사용할 수 있는 기획 AI 요청 횟수에 도달했습니다."
        : "다른 기획 요청이 처리 중이거나 예약하지 못했습니다. 최신 상태를 확인해 주세요. AI를 호출하지 않았습니다.",
      409,
    );
}
export async function failGeneration(
  client: SupabaseClient<Database>,
  input: GenerationIntent,
) {
  const { error } = await client
    .from("planning_generation_requests")
    .update({
      status: "failed",
      error_message: "생성 또는 결과 저장을 완료하지 못했습니다.",
    })
    .eq("id", input.requestId)
    .eq("requested_by", input.userId)
    .eq("status", "running");
  // 실패 상태 기록이 실패해도 기존 running 예약을 남겨 재호출을 막습니다.
  return !error;
}
export async function completeGeneration(
  client: SupabaseClient<Database>,
  input: GenerationIntent,
  snapshot: Json,
) {
  const { data, error } = await client
    .rpc("complete_planning_generation", {
      p_request_id: input.requestId,
      p_snapshot: snapshot,
    })
    .single();
  if (error || !data)
    throw new GenerationRequestError(
      "생성 결과의 저장 여부를 확인하지 못했습니다. 같은 요청으로 상태를 다시 확인해 주세요. 자동으로 재생성하지 않습니다.",
      error?.code === "40001" || error?.code === "23505" ? 409 : 503,
    );
  return data;
}
