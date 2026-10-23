import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiProjectAccess } from "@/lib/api-access";
import { aiEnabled, configuredModel, generatePlan } from "@/lib/ai";
import { decodeFinding, findingIssues } from "@/lib/analysis";
import { planIssues } from "@/lib/planning";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return apiError("허용되지 않은 요청입니다.", 403);
  const parsed = z
    .object({
      projectId: z.uuid(),
      productId: z.uuid(),
      consent: z.literal(true),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("기획할 제품 정보를 확인해 주세요.");
  const access = await apiProjectAccess(request, parsed.data.projectId);
  if (access.error) return access.error;
  if (!aiEnabled())
    return apiError("AI 연결과 사용 예산 설정을 준비하고 있습니다.", 503);
  const { supabase, project } = access;
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", parsed.data.productId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (!product?.ingredients?.trim())
    return apiError("전성분을 포함한 제품 브리프를 먼저 저장해 주세요.", 409);
  const { data: files, error: filesError } = await supabase
    .from("source_files")
    .select("id,product_id")
    .eq("project_id", project.id);
  if (filesError) return apiError("제품 원본을 확인하지 못했습니다.", 500);
  const ids = (files ?? [])
    .filter((f) => !f.product_id || f.product_id === product.id)
    .map((f) => f.id);
  const { data: evidence, error } = ids.length
    ? await supabase
        .from("evidence")
        .select("*")
        .in("source_file_id", ids)
        .eq("review_status", "approved")
    : { data: [], error: null };
  if (error) return apiError("승인된 근거를 불러오지 못했습니다.", 500);
  if (!evidence?.length)
    return apiError(
      "자료를 분석하고 원문과 대조한 근거를 한 개 이상 승인해 주세요.",
      409,
    );
  for (const item of evidence) {
    const finding = decodeFinding(item.extracted_result);
    if (
      !finding ||
      finding.evidenceType !== item.evidence_type ||
      findingIssues({
        ...finding,
        pageNumber: item.page_number,
        sourceExcerpt: item.source_excerpt,
        suggestedClaim: item.suggested_claim,
      }).length
    )
      return apiError(
        "승인된 근거의 형식·수치·페이지를 다시 확인해 주세요.",
        422,
      );
  }
  try {
    const model = await configuredModel("text");
    const plan = await generatePlan(model, {
      brand: project.brand,
      product,
      evidence: evidence.map((e) => ({
        id: e.id,
        type: e.evidence_type,
        excerpt: e.source_excerpt,
        claim: e.suggested_claim,
      })),
    });
    const issues = planIssues(plan, product, evidence);
    if (issues.length)
      return apiError(
        `초안 검증을 통과하지 못했습니다: ${issues.join(" ")} 자동 재생성하지 않습니다.`,
        422,
      );
    return NextResponse.json({ plan });
  } catch {
    return apiError(
      "기획을 완료하지 못했습니다. AI 연결과 예산 상태를 확인해 주세요.",
      502,
    );
  }
}
