import { z } from "zod";

export const categories = {
  "페이스 클렌징": [
    "폼",
    "팩 클렌저(거품형)",
    "오일",
    "밀크",
    "밤",
    "워터",
    "티슈",
  ],
  "헤어·바디": ["샴푸", "트리트먼트", "바디워시", "올인원 워시"],
  "민감 부위 클렌징": ["여성청결제", "여성청결티슈", "항문세정제"],
  "기초 스킨케어": ["크림", "로션", "세럼", "앰플", "아이크림"],
  "미스트·토너": ["수분 미스트", "기능성 미스트", "토너"],
  패드: ["진정 패드", "각질 패드", "보습 패드", "토너 패드"],
  "팩트·파우더": ["노세범 팩트", "피지 컨트롤 파우더", "블러 팩트"],
} as const;
export type Category = keyof typeof categories;
const text = z
  .string()
  .trim()
  .max(10000, "입력은 10,000자 이내로 작성해 주세요.");
const required = text.min(1, "필수 항목을 입력해 주세요.");
export const briefSchema = z.object({
  name: required.max(200),
  category: z.enum(Object.keys(categories) as [Category, ...Category[]]),
  subtype: required.max(100),
  ingredients: required,
  highlighted_ingredients: text,
  features: z.object({
    ph: text.refine(
      (v) =>
        !v || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 14),
      "pH는 0부터 14 사이의 숫자입니다.",
    ),
    fragrance: text,
    texture: text,
    foam: text,
    packaging: text,
    certifications: text,
    clinical: text,
    target: text,
    other: text,
    emulsification: text,
    rinsing: text,
    finish: text,
    scalp: text,
    sensitivity: text,
    absorption: text,
    spray: text,
    pad: text,
    coverage: text,
  }),
});
export type Brief = z.infer<typeof briefSchema>;
export const emptyFeatures: Brief["features"] = {
  ph: "",
  fragrance: "",
  texture: "",
  foam: "",
  packaging: "",
  certifications: "",
  clinical: "",
  target: "",
  other: "",
  emulsification: "",
  rinsing: "",
  finish: "",
  scalp: "",
  sensitivity: "",
  absorption: "",
  spray: "",
  pad: "",
  coverage: "",
};
export const emptyBrief: Brief = {
  name: "",
  category: "페이스 클렌징",
  subtype: "폼",
  ingredients: "",
  highlighted_ingredients: "",
  features: emptyFeatures,
};
export const isFoaming = (category: string, subtype: string) =>
  (category === "페이스 클렌징" &&
    ["폼", "팩 클렌저(거품형)"].includes(subtype)) ||
  (category === "헤어·바디" &&
    ["샴푸", "바디워시", "올인원 워시"].includes(subtype)) ||
  (category === "민감 부위 클렌징" &&
    ["여성청결제", "항문세정제"].includes(subtype));
export function conditionalFields(
  category: string,
  subtype: string,
): (keyof Brief["features"])[] {
  const fields: (keyof Brief["features"])[] = [];
  if (isFoaming(category, subtype)) fields.push("foam");
  if (category === "페이스 클렌징" && subtype === "오일")
    fields.push("emulsification", "rinsing", "finish");
  if (category === "헤어·바디") fields.push("scalp");
  if (category === "민감 부위 클렌징") fields.push("sensitivity");
  if (category === "기초 스킨케어") fields.push("absorption");
  if (category === "미스트·토너") fields.push("spray");
  if (category === "패드") fields.push("pad");
  if (category === "팩트·파우더") fields.push("coverage");
  return fields;
}
export const featureLabels: Record<keyof Brief["features"], string> = {
  ph: "pH",
  fragrance: "향",
  texture: "제형 및 사용감",
  foam: "거품 특성",
  packaging: "용기·부자재 강점",
  certifications: "기능성·인증",
  clinical: "임상·시험 결과",
  target: "타깃 소비자",
  other: "기타 제품 특징",
  emulsification: "유화 속도",
  rinsing: "물로 씻어낼 때의 사용감",
  finish: "세안 후 마무리감",
  scalp: "두피·모발 또는 바디의 고민",
  sensitivity: "민감 부위 사용 시 고려사항",
  absorption: "흡수감·보습감",
  spray: "분사 방식 또는 닦아 쓰는 방법",
  pad: "패드 소재·크기·사용 방식",
  coverage: "피지 조절·커버·마무리감",
};
