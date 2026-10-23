import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { decodeFinding, findingIssues } from "./analysis";
import type { Citation, PlanBasis } from "./plan-document";
export async function planningContext(
  supabase: SupabaseClient<Database>,
  projectId: string,
  productId: string,
  brand: string,
) {
  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !product?.ingredients?.trim())
    throw new Error("전성분을 포함한 제품 브리프를 먼저 저장해 주세요.");
  const { data: files, error: filesError } = await supabase
    .from("source_files")
    .select("id,product_id,filename")
    .eq("project_id", projectId);
  if (filesError) throw new Error("제품 원본을 확인하지 못했습니다.");
  const visible = (files ?? []).filter(
    (f) => !f.product_id || f.product_id === productId,
  );
  const { data: evidence, error: evidenceError } = visible.length
    ? await supabase
        .from("evidence")
        .select("*")
        .in(
          "source_file_id",
          visible.map((f) => f.id),
        )
        .eq("review_status", "approved")
        .limit(101)
    : { data: [], error: null };
  if (evidenceError || (evidence?.length ?? 0) > 100)
    throw new Error("승인된 근거를 불러오지 못했거나 한도를 초과했습니다.");
  const sources: Citation[] = [];
  for (const e of evidence ?? []) {
    const finding = decodeFinding(e.extracted_result);
    if (
      !finding ||
      finding.evidenceType !== e.evidence_type ||
      findingIssues({
        ...finding,
        pageNumber: e.page_number,
        sourceExcerpt: e.source_excerpt,
        suggestedClaim: e.suggested_claim,
      }).length
    )
      throw new Error("승인된 근거의 형식·수치·페이지를 다시 확인해 주세요.");
    const file = visible.find((f) => f.id === e.source_file_id)!;
    sources.push({
      id: e.id,
      sourceFileId: file.id,
      filename: file.filename,
      type: e.evidence_type,
      excerpt: e.source_excerpt,
      claim: e.suggested_claim,
      page: e.page_number,
    });
  }
  const basis: PlanBasis = {
    productId,
    brand,
    name: product.name,
    category: product.category,
    subtype: product.subtype,
    ingredients: product.ingredients,
  };
  return { product, basis, sources };
}
