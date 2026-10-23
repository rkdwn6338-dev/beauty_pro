import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiProjectAccess } from "@/lib/api-access";
import { findingSchema, findingIssues } from "@/lib/analysis";
import {
  aiEnabled,
  evidenceWriteEnabled,
  configuredModel,
  analyzeDocument,
} from "@/lib/ai";
import {
  BUCKET,
  belongsToProject,
  fileSignatureMatches,
  MAX_FILE_BYTES,
} from "@/lib/files";
import type { Json } from "@/lib/database.types";

export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("analyze"),
    projectId: z.uuid(),
    fileId: z.uuid(),
    consent: z.literal(true),
  }),
  z.object({
    operation: z.literal("review"),
    projectId: z.uuid(),
    evidenceId: z.uuid(),
    finding: findingSchema,
    decision: z.enum(["approved", "rejected"]),
    sourceChecked: z.boolean(),
  }),
]);
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return apiError("허용되지 않은 요청입니다.", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("분석 요청 정보를 확인해 주세요.");
  const input = parsed.data;
  const access = await apiProjectAccess(request, input.projectId);
  if (access.error) return access.error;
  const { supabase, user } = access;
  if (!evidenceWriteEnabled())
    return apiError("근거 저장 연결을 준비하고 있습니다.", 503);
  if (input.operation === "review") {
    const { data: evidence } = await supabase
      .from("evidence")
      .select("id,source_file_id,review_status,extracted_result")
      .eq("id", input.evidenceId)
      .maybeSingle();
    if (!evidence) return apiError("근거를 찾을 수 없습니다.", 404);
    const { data: file } = await supabase
      .from("source_files")
      .select("id")
      .eq("id", evidence.source_file_id)
      .eq("project_id", input.projectId)
      .maybeSingle();
    if (!file) return apiError("근거에 접근할 수 없습니다.", 404);
    if (evidence.review_status !== "pending")
      return apiError("이미 검토한 근거는 변경하지 않습니다.", 409);
    const issues = findingIssues(input.finding);
    if (
      input.decision === "approved" &&
      (!input.sourceChecked || issues.length)
    )
      return apiError(issues[0] ?? "원본을 직접 확인한 뒤 승인해 주세요.", 422);
    const { data, error } = await supabase
      .from("evidence")
      .update({
        evidence_type: input.finding.evidenceType,
        source_excerpt: input.finding.sourceExcerpt,
        page_number: input.finding.pageNumber,
        suggested_claim: input.finding.suggestedClaim,
        extracted_result: {
          ...(evidence.extracted_result &&
          typeof evidence.extracted_result === "object" &&
          !Array.isArray(evidence.extracted_result)
            ? evidence.extracted_result
            : {}),
          ...input.finding,
        } as Json,
        review_status: input.decision,
        reviewed_by: user.id,
      })
      .eq("id", evidence.id)
      .eq("review_status", "pending")
      .select("id")
      .maybeSingle();
    if (error || !data)
      return apiError(
        "검토 결과를 저장하지 못했습니다. 새로고침 후 확인해 주세요.",
        409,
      );
    return NextResponse.json({ success: true });
  }
  if (!aiEnabled())
    return apiError("AI 연결과 사용 예산 설정을 준비하고 있습니다.", 503);
  const { data: file } = await supabase
    .from("source_files")
    .select("*")
    .eq("id", input.fileId)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (!file || !belongsToProject(file.storage_path, input.projectId))
    return apiError("원본을 찾을 수 없습니다.", 404);
  if (!["uploaded", "analyzed"].includes(file.status))
    return apiError("업로드가 완료된 자료만 분석할 수 있습니다.", 409);
  if (!file.bytes || file.bytes > MAX_FILE_BYTES)
    return apiError("분석할 원본의 용량을 확인해 주세요.");
  let model: string;
  try {
    model = await configuredModel(
      file.mime_type === "application/pdf" ? "pdf" : "image",
    );
  } catch {
    return apiError("AI 모델·인증·문서 형식 설정을 확인해 주세요.", 503);
  }
  const { data: blob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(file.storage_path);
  if (
    downloadError ||
    !blob ||
    blob.size !== file.bytes ||
    !fileSignatureMatches(
      new Uint8Array(await blob.slice(0, 16).arrayBuffer()),
      file.mime_type ?? "",
    )
  )
    return apiError("분석할 원본의 형식과 용량을 확인하지 못했습니다.", 409);
  // 중단된 이전 요청을 정리합니다. 실제 생성 호출은 40초 제한이며 자동 재시도하지 않습니다.
  const { error: recoveryError } = await supabase
    .from("analysis_jobs")
    .update({
      status: "failed",
      error_message: "시간이 초과되어 분석을 다시 시도할 수 있습니다.",
    })
    .eq("source_file_id", file.id)
    .in("status", ["running", "queued"])
    .lt("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());
  if (recoveryError)
    return apiError("분석 작업 저장 권한을 확인해 주세요.", 503);
  const { data: job, error: jobError } = await supabase
    .from("analysis_jobs")
    .insert({ source_file_id: file.id, status: "running" })
    .select("id")
    .single();
  if (jobError || !job)
    return apiError(
      "이미 분석 중이거나 작업 저장 권한이 없습니다. 잠시 후 확인해 주세요.",
      409,
    );
  try {
    const { analysis, usage } = await analyzeDocument(
      model,
      new Uint8Array(await blob.arrayBuffer()),
      file.mime_type!,
    );
    if (analysis.findings.length) {
      const { error } = await supabase.from("evidence").insert(
        analysis.findings.map((finding) => ({
          source_file_id: file.id,
          evidence_type: finding.evidenceType,
          page_number: finding.pageNumber,
          source_excerpt: finding.sourceExcerpt,
          suggested_claim: finding.suggestedClaim,
          extracted_result: { ...finding, analysisJobId: job.id } as Json,
          review_status: "pending",
          reviewed_by: null,
        })),
      );
      if (error) throw new Error("근거 저장 실패");
    }
    const { data: completed, error } = await supabase
      .from("analysis_jobs")
      .update({
        status: "completed",
        result: { analysis, usage, model } as Json,
      })
      .eq("id", job.id)
      .eq("status", "running")
      .select("id")
      .maybeSingle();
    if (error || !completed) throw new Error("작업 완료 저장 실패");
    const { error: fileError } = await supabase
      .from("source_files")
      .update({ status: "analyzed" })
      .eq("id", file.id);
    return NextResponse.json({
      success: true,
      findings: analysis.findings.length,
      warnings: analysis.warnings,
      notice: fileError
        ? "근거는 저장됐지만 원본의 분석 완료 표시를 갱신하지 못했습니다."
        : undefined,
    });
  } catch {
    await supabase
      .from("analysis_jobs")
      .update({
        status: "failed",
        error_message:
          "분석 또는 결과 저장에 실패했습니다. 이미 등록된 검토 대기 근거가 있는지 먼저 확인해 주세요.",
      })
      .eq("id", job.id)
      .eq("status", "running");
    return apiError(
      "분석을 완료하지 못했습니다. 검토 대기 근거와 연결·예산 상태를 확인해 주세요. 자동으로 재호출하지 않습니다.",
      502,
    );
  }
}
