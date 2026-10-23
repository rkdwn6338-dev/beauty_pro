import { z } from "zod";

const text = z.string().trim().max(3000);
export const findingSchema = z.object({
  evidenceType: z.enum([
    "clinical",
    "functional",
    "safety",
    "ingredient",
    "other",
  ]),
  studyName: text.nullable(),
  institution: text.nullable(),
  subjects: text.nullable(),
  duration: text.nullable(),
  result: text.min(1),
  measurements: z
    .array(
      z.object({
        metric: text.min(1),
        value: z
          .string()
          .trim()
          .regex(/^-?\d+(?:,\d{3})*(?:\.\d+)?$/),
        unit: z.string().trim().min(1).max(40),
      }),
    )
    .max(20),
  pageNumber: z.number().int().min(1).max(10000).nullable(),
  sourceExcerpt: text.min(1),
  suggestedClaim: text.nullable(),
  limitations: z.array(text).max(10),
});
export const analysisSchema = z.object({
  documentType: z.string().trim().min(1).max(200),
  summary: text.min(1),
  findings: z.array(findingSchema).max(30),
  warnings: z.array(text).max(20),
});
export type Finding = z.infer<typeof findingSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export const evidenceLabels: Record<Finding["evidenceType"], string> = {
  clinical: "인체적용시험",
  functional: "기능성 보고·인증",
  safety: "안전성·사용적합성",
  ingredient: "원료 특성",
  other: "기타 근거",
};
const normalized = (value: string) =>
  value.normalize("NFKC").replace(/,/g, "").replace(/\s/g, "");
export function quantities(value: string): string[] {
  return (
    value.match(
      /-?\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|mg|mL|ml|ppm|g|명|일|주|시간|분|초|배|종)|pH\s*\d+(?:\.\d+)?/gi,
    ) ?? []
  );
}
export function findingIssues(finding: Finding): string[] {
  const issues: string[] = [];
  if (!finding.pageNumber)
    issues.push("근거가 있는 원본 페이지를 확인해 주세요.");
  for (const measure of finding.measurements) {
    const values =
      finding.sourceExcerpt.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) ?? [];
    if (
      !values.some(
        (value) => normalized(value) === normalized(measure.value),
      ) ||
      !normalized(finding.sourceExcerpt).includes(
        normalized(measure.value + measure.unit),
      )
    )
      issues.push(`${measure.metric}: 수치·단위가 인용문과 일치하지 않습니다.`);
  }
  const claim = finding.suggestedClaim ?? "";
  if (/치료|완치|의학적|부작용\s*없|100\s*%\s*안전/.test(claim))
    issues.push("치료·안전성 보장 표현은 이 근거로 승인할 수 없습니다.");
  if (
    ["functional", "safety", "ingredient"].includes(finding.evidenceType) &&
    /개선율|치료|임상\s*효과|주름\s*개선\s*\d/.test(claim)
  )
    issues.push(
      "보고·사용적합성·원료 특성을 완제품의 개선율로 바꿀 수 없습니다.",
    );
  const allowedNumbers = new Set(
    (finding.sourceExcerpt.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map(
      normalized,
    ),
  );
  if (
    (
      (claim + " " + finding.result).match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []
    ).some((n) => !allowedNumbers.has(normalized(n)))
  )
    issues.push("활용 카피에 인용문에 없는 수치가 있습니다.");
  if (
    quantities(claim + " " + finding.result).some(
      (quantity) =>
        !normalized(finding.sourceExcerpt)
          .toLowerCase()
          .includes(normalized(quantity).toLowerCase()),
    )
  )
    issues.push("결과·카피의 수치와 단위가 인용문과 일치하지 않습니다.");
  return [...new Set(issues)];
}
export function decodeFinding(value: unknown): Finding | null {
  const parsed = findingSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
