import { describe, it, expect } from "vitest";
import {
  briefSchema,
  emptyBrief,
  conditionalFields,
  isFoaming,
  categories,
} from "@/lib/brief";
const valid = {
  ...emptyBrief,
  name: "클렌징 오일",
  ingredients: "정제수, 글리세린",
};
describe("제품 브리프 입력", () => {
  it("제품명과 전성분을 필수로 검증한다", () => {
    expect(briefSchema.safeParse(emptyBrief).success).toBe(false);
    expect(briefSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
    expect(briefSchema.safeParse({ ...valid, ingredients: "" }).success).toBe(
      false,
    );
    expect(briefSchema.safeParse(valid).success).toBe(true);
  });
  it("pH 범위를 벗어난 입력과 숫자가 아닌 입력을 거절한다", () => {
    for (const ph of ["-1", "14.1", "약산성", "Infinity"])
      expect(
        briefSchema.safeParse({ ...valid, features: { ...valid.features, ph } })
          .success,
      ).toBe(false);
    for (const ph of ["", "0", "5.5", "14"])
      expect(
        briefSchema.safeParse({ ...valid, features: { ...valid.features, ph } })
          .success,
      ).toBe(true);
  });
  it("모든 대분류에서 직접 입력한 세부 품목을 허용한다", () => {
    for (const category of Object.keys(categories))
      expect(
        briefSchema.safeParse({ ...valid, category, subtype: "직접 입력 품목" })
          .success,
      ).toBe(true);
  });
  it("오일의 유화·헹굼·마무리를 구분하고 거품을 강제하지 않는다", () => {
    expect(conditionalFields("페이스 클렌징", "오일")).toEqual([
      "emulsification",
      "rinsing",
      "finish",
    ]);
    expect(isFoaming("페이스 클렌징", "오일")).toBe(false);
    expect(conditionalFields("페이스 클렌징", "밤")).not.toContain("foam");
  });
  it("거품형 제품의 거품 질문을 누락하지 않는다", () => {
    for (const [category, subtype] of [
      ["페이스 클렌징", "폼"],
      ["페이스 클렌징", "팩 클렌저(거품형)"],
      ["헤어·바디", "샴푸"],
      ["헤어·바디", "바디워시"],
      ["헤어·바디", "올인원 워시"],
    ])
      expect(conditionalFields(category, subtype)).toContain("foam");
  });
});
