import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiProjectAccess } from "@/lib/api-access";
import {
  aiEnabled,
  configuredModel,
  generatePlan,
  regenerateSection,
} from "@/lib/ai";
import {
  findGeneration,
  reserveGeneration,
  completeGeneration,
  failGeneration,
  GenerationRequestError,
  boundedPlanningInput,
  type GenerationIntent,
} from "@/lib/generation-requests";
import { planningContext } from "@/lib/planning-context";
import {
  changeApproval,
  createDocument,
  editDocument,
  manualPlan,
  planDocumentSchema,
  sameValue,
  replaceSection,
  type PlanDocument,
  type VersionAction,
} from "@/lib/plan-document";
import { planIssues } from "@/lib/planning";
import type { Json } from "@/lib/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;
const inputSchema = z
  .object({
    operation: z.enum([
      "read",
      "history",
      "manual",
      "generate",
      "edit",
      "approve",
      "unapprove",
      "restore",
      "regenerate_section",
    ]),
    projectId: z.uuid(),
    productId: z.uuid(),
    baseId: z.uuid().nullable().optional(),
    versionId: z.uuid().optional(),
    sectionId: z.uuid().optional(),
    beforeRevision: z.number().int().positive().optional(),
    snapshot: planDocumentSchema.optional(),
    consent: z.boolean().optional(),
    requestId: z.uuid().optional(),
    checkOnly: z.boolean().optional(),
    instruction: z.string().trim().max(1000).optional(),
  })
  .strict();
const response = (data: unknown) =>
  NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return apiError("허용되지 않은 요청입니다.", 403);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 600000)
    return apiError("기획서 크기 한도를 초과했습니다.", 413);
  const parsed = inputSchema.safeParse(
    (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })(),
  );
  if (!parsed.success) return apiError("기획서 요청 정보를 확인해 주세요.");
  const input = parsed.data;
  const access = await apiProjectAccess(request, input.projectId);
  if (access.error) return access.error;
  if (process.env.ENABLE_PLAN_STORAGE !== "true")
    return apiError("기획서 버전 저장소의 연결을 준비하고 있습니다.", 503);
  const { supabase, user, project } = access;
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", input.productId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (!product) return apiError("제품에 접근할 수 없습니다.", 404);
  const generation =
    input.operation === "generate" || input.operation === "regenerate_section";
  let intent: GenerationIntent | null = null;
  if (generation) {
    if (!input.requestId || input.baseId === undefined)
      return apiError("AI 요청 번호와 기준 버전을 확인해 주세요.");
    intent = {
      requestId: input.requestId,
      projectId: project.id,
      productId: product.id,
      agencyId: project.agency_id,
      userId: user.id,
      operation: input.operation as "generate" | "regenerate_section",
      baseId: input.baseId,
      sectionId: input.sectionId,
      instruction: input.instruction,
    };
    try {
      const replay = await findGeneration(supabase, intent);
      if (replay) return response({ version: replay, replayed: true });
      if (input.checkOnly)
        return apiError(
          "이 번호로 시작한 AI 요청이 없습니다. 새 요청으로 시작할 수 있습니다.",
          404,
        );
    } catch (error) {
      return apiError(
        error instanceof Error
          ? error.message
          : "AI 요청 상태를 확인하지 못했습니다.",
        error instanceof GenerationRequestError ? error.status : 503,
      );
    }
  } else if (input.checkOnly)
    return apiError("AI 요청의 상태만 확인할 수 있습니다.");
  let reserved = false;
  // 예약·생성·저장 오류에서 기존 예약을 남기거나 종료하여 자동 재호출을 막습니다.
  const markFailed = async () => {
    if (reserved && intent)
      await failGeneration(supabase, intent).catch(() => false);
  };
  const latestQuery = () =>
    supabase
      .from("planning_versions")
      .select("*")
      .eq("product_id", product.id)
      .eq("project_id", project.id)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();
  const { data: latest, error: readError } = await latestQuery();
  if (readError) return apiError("기획서를 불러오지 못했습니다.", 500);
  if (input.operation === "read" || input.operation === "history") {
    let historyQuery = supabase
      .from("planning_versions")
      .select("id,revision,action,created_at,created_by,restored_from")
      .eq("product_id", product.id)
      .eq("project_id", project.id)
      .order("revision", { ascending: false })
      .limit(20);
    if (input.beforeRevision)
      historyQuery = historyQuery.lt("revision", input.beforeRevision);
    const { data: history, error } = await historyQuery;
    if (error) return apiError("버전 목록을 불러오지 못했습니다.", 500);
    if (input.operation === "history") return response({ history });
    const selected = input.versionId
      ? await supabase
          .from("planning_versions")
          .select("*")
          .eq("product_id", product.id)
          .eq("project_id", project.id)
          .eq("id", input.versionId)
          .maybeSingle()
      : { data: latest, error: null };
    if (selected.error || (input.versionId && !selected.data))
      return apiError("버전을 찾을 수 없습니다.", 404);
    if (
      selected.data &&
      !planDocumentSchema.safeParse(selected.data.snapshot).success
    )
      return apiError("저장된 기획서 형식을 확인해 주세요.", 422);
    return response({
      version: selected.data,
      latestId: latest?.id ?? null,
      history,
    });
  }
  if (input.baseId === undefined || input.baseId !== (latest?.id ?? null))
    return apiError(
      "다른 창에서 새 버전을 저장했습니다. 최신 버전을 불러온 뒤 다시 작업해 주세요.",
      409,
    );
  let snapshot: PlanDocument;
  let action: VersionAction;
  try {
    if (input.operation === "manual" || input.operation === "generate") {
      const context = await planningContext(
        supabase,
        project.id,
        product.id,
        project.brand,
      );
      let plan = manualPlan(context.basis);
      action = latest ? "generate" : "create";
      if (input.operation === "generate") {
        if (!aiEnabled())
          return apiError("AI 연결과 사용 예산 설정을 준비하고 있습니다.", 503);
        if (input.consent !== true)
          return apiError("제품 정보와 승인된 근거의 AI 전송에 동의해 주세요.");
        if (!context.sources.length)
          return apiError(
            "원문과 대조한 근거를 한 개 이상 승인해 주세요.",
            409,
          );
        try {
          const model = await configuredModel("text");
          const providerInput = {
            brand: project.brand,
            product: context.product,
            evidence: context.sources.map((s) => ({
              id: s.id,
              type: s.type,
              excerpt: s.excerpt,
              claim: s.claim,
            })),
          };
          boundedPlanningInput(providerInput);
          await reserveGeneration(supabase, intent!, model);
          reserved = true;
          plan = await generatePlan(model, providerInput);
        } catch (error) {
          await markFailed();
          if (error instanceof GenerationRequestError)
            return apiError(error.message, error.status);
          return apiError(
            "AI 기획을 완료하지 못했습니다. 연결과 사용 예산을 확인해 주세요. 자동으로 재시도하지 않습니다.",
            502,
          );
        }
        const issues = planIssues(
          plan,
          context.product,
          context.sources.map((s) => ({
            id: s.id,
            source_excerpt: s.excerpt,
            suggested_claim: s.claim,
          })),
        );
        if (issues.length) {
          await markFailed();
          return apiError(
            `초안 검증을 통과하지 못했습니다: ${issues.join(" ")}`,
            422,
          );
        }
      }
      snapshot = createDocument(plan, context.basis, context.sources);
    } else {
      if (!latest) return apiError("기획서를 먼저 시작해 주세요.", 409);
      const base = planDocumentSchema.parse(latest.snapshot);
      action = input.operation;
      if (input.operation === "edit") {
        snapshot = editDocument(base, input.snapshot);
        if (sameValue(base, snapshot))
          return apiError("변경한 내용이 없습니다.", 409);
      } else if (input.operation === "restore") {
        if (!input.versionId || input.versionId === latest.id)
          return apiError("복구할 이전 버전을 선택해 주세요.");
        const { data: target } = await supabase
          .from("planning_versions")
          .select("snapshot")
          .eq("id", input.versionId)
          .eq("product_id", product.id)
          .eq("project_id", project.id)
          .maybeSingle();
        if (!target) return apiError("복구할 버전을 찾을 수 없습니다.", 404);
        snapshot = planDocumentSchema.parse(target.snapshot);
      } else if (input.operation === "regenerate_section") {
        const section = base.sections.find((s) => s.id === input.sectionId);
        if (!section || section.status !== "draft")
          return apiError("승인 전 구좌만 재생성할 수 있습니다.", 409);
        if (!aiEnabled())
          return apiError("AI 연결과 사용 예산 설정을 준비하고 있습니다.", 503);
        if (input.consent !== true)
          return apiError("기획 정보와 승인된 근거의 AI 전송에 동의해 주세요.");
        let content;
        try {
          const model = await configuredModel("text");
          const providerInput = {
            basis: base.basis,
            coreUsp: base.coreUsp,
            strategy: base.strategy,
            section,
            sources: base.sources,
            instruction: input.instruction ?? "",
          };
          boundedPlanningInput(providerInput);
          await reserveGeneration(supabase, intent!, model);
          reserved = true;
          content = await regenerateSection(model, providerInput);
        } catch (error) {
          await markFailed();
          if (error instanceof GenerationRequestError)
            return apiError(error.message, error.status);
          return apiError(
            "구좌 재생성을 완료하지 못했습니다. 연결과 사용 예산을 확인해 주세요. 자동으로 재시도하지 않습니다.",
            502,
          );
        }
        snapshot = replaceSection(base, section.id, content);
      } else {
        if (!input.sectionId) return apiError("구좌를 선택해 주세요.");
        snapshot = changeApproval(
          base,
          input.sectionId,
          input.operation === "approve",
          user.id,
        );
      }
    }
  } catch (error) {
    await markFailed();
    return apiError(
      error instanceof z.ZodError
        ? "기획서 입력 형식을 확인해 주세요."
        : error instanceof Error
          ? error.message
          : "기획서를 만들지 못했습니다.",
      422,
    );
  }
  if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > 500000) {
    await markFailed();
    return apiError("기획서 크기 한도를 초과했습니다.", 413);
  }
  if (generation && intent) {
    try {
      const version = await completeGeneration(
        supabase,
        intent,
        snapshot as unknown as Json,
      );
      return response({ version });
    } catch (error) {
      // DB 완료 응답이 유실됐을 수 있으므로 failed로 덮어쓰지 않고 같은 번호로 확인합니다.
      return apiError(
        error instanceof Error
          ? error.message
          : "저장 결과를 확인하지 못했습니다.",
        error instanceof GenerationRequestError ? error.status : 503,
      );
    }
  }
  const { data: version, error: saveError } = await supabase
    .from("planning_versions")
    .insert({
      project_id: project.id,
      product_id: product.id,
      revision: (latest?.revision ?? 0) + 1,
      parent_id: latest?.id ?? null,
      action,
      changed_section_id:
        action === "approve" ||
        action === "unapprove" ||
        action === "regenerate_section"
          ? input.sectionId
          : null,
      restored_from: action === "restore" ? input.versionId : null,
      snapshot: snapshot as unknown as Json,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (saveError) {
    if (saveError.code === "23505" || saveError.code === "40001")
      return apiError(
        "다른 창에서 새 버전을 저장했습니다. 작성 내용을 보관한 뒤 최신 버전을 불러와 주세요.",
        409,
      );
    return apiError(
      "버전을 저장하지 못했습니다. 작성 내용은 화면에 남아 있습니다. 다시 시도하기 전에 최신 버전을 확인해 주세요.",
      500,
    );
  }
  return response({ version });
}
