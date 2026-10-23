import { z } from "zod";
import { isFoaming } from "./brief";
import { quantities } from "./analysis";

export const sectionSchema = z.object({
  type: z.enum([
    "hero",
    "problem",
    "point",
    "foam",
    "clinical",
    "recommendation",
    "closing",
    "how_to_use",
    "product_visual",
  ]),
  headline: z.string().trim().min(1).max(200),
  body: z.string().trim().max(3000),
  visualGuide: z.string().trim().min(1).max(2000),
  evidenceIds: z.array(z.uuid()).max(20),
});
export const planSchema = z.object({
  coreUsp: z.string().trim().min(1).max(2000),
  strategy: z.string().trim().min(1).max(2000),
  ingredientInsights: z
    .array(
      z.object({
        ingredient: z.string().min(1).max(200),
        role: z.string().min(1).max(1000),
        limitation: z.string().min(1).max(1000),
      }),
    )
    .max(20),
  sections: z.array(sectionSchema).min(5).max(25),
  cautions: z.array(z.string().max(2000)).max(20),
});
export type Plan = z.infer<typeof planSchema>;
export function planIssues(
  plan: Plan,
  product: {
    category: string | null;
    subtype: string | null;
    ingredients: string | null;
  },
  evidence: {
    id: string;
    source_excerpt: string;
    suggested_claim: string | null;
  }[],
): string[] {
  const issues: string[] = [];
  const tail = plan.sections.slice(-4).map((section) => section.type);
  if (tail.join(",") !== "recommendation,closing,how_to_use,product_visual")
    issues.push(
      "후반부는 추천 대상 → 마무리 → 사용방법 → 제품 연출 순서여야 합니다.",
    );
  if (plan.sections.filter((s) => s.type === "closing").length !== 1)
    issues.push("마무리 구좌는 정확히 하나여야 합니다.");
  if (
    isFoaming(product.category ?? "", product.subtype ?? "") &&
    !plan.sections.some((s) => s.type === "foam")
  )
    issues.push("거품형 세정 제품에 거품 소구가 누락됐습니다.");
  const byId = new Map(evidence.map((item) => [item.id, item]));
  for (const section of plan.sections) {
    if (section.evidenceIds.some((id) => !byId.has(id)))
      issues.push("승인되지 않은 근거가 연결됐습니다.");
    if (section.type === "clinical" && section.evidenceIds.length === 0)
      issues.push("시험 결과 구좌에는 승인된 근거가 필요합니다.");
    const copy = section.headline + " " + section.body;
    if (/치료|완치|부작용\s*없|100\s*%\s*안전/.test(copy))
      issues.push("치료·안전성 보장 카피가 포함됐습니다.");
    const source = section.evidenceIds
      .map((id) => byId.get(id)?.source_excerpt ?? "")
      .join(" ")
      .replace(/,/g, "");
    // 효능 수치는 해당 구좌에 연결된 원문 인용에서만 가져옵니다.
    const sourceQuantities = new Set(
      quantities(source).map((quantity) =>
        quantity.replace(/\s/g, "").toLowerCase(),
      ),
    );
    for (const claim of quantities(copy))
      if (!sourceQuantities.has(claim.replace(/\s/g, "").toLowerCase()))
        issues.push("연결된 근거에 없는 수치·단위가 카피에 포함됐습니다.");
  }
  const ingredients = new Set(
    (product.ingredients ?? "")
      .normalize("NFKC")
      .toLowerCase()
      .split(/[,，;\n]+/)
      .map((item) => item.trim()),
  );
  for (const item of plan.ingredientInsights)
    if (!ingredients.has(item.ingredient.normalize("NFKC").toLowerCase()))
      issues.push("전성분에 없는 성분이 분석에 포함됐습니다.");
  return [...new Set(issues)];
}
