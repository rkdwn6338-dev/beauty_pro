import { describe, expect, it } from "vitest";
import { analysisSchema, findingIssues } from "@/lib/analysis";
import { planIssues } from "@/lib/planning";
import { demoFinding, demoEvidence, demoPlan } from "@/lib/analysis-demo";
const product = {
  category: "페이스 클렌징",
  subtype: "폼",
  ingredients: "정제수, 글리세린",
};
const evidence = [demoEvidence];
describe("AI 근거 검수", () => {
  it("근거가 없는 문서는 결과를 만들어 넣지 않아도 된다", () => {
    expect(
      analysisSchema.safeParse({
        documentType: "제품 사진",
        summary: "시험 근거 없음",
        findings: [],
        warnings: [],
      }).success,
    ).toBe(true);
  });
  it("원문 인용의 수치와 단위가 일치해야 한다", () => {
    expect(findingIssues(demoFinding)).toEqual([]);
    expect(
      findingIssues({
        ...demoFinding,
        measurements: [{ metric: "변화", value: "12", unit: "%" }],
      }),
    ).toContain("변화: 수치·단위가 인용문과 일치하지 않습니다.");
    expect(
      findingIssues({
        ...demoFinding,
        measurements: [{ metric: "변화", value: "12.5", unit: "mg" }],
      }),
    ).toContain("변화: 수치·단위가 인용문과 일치하지 않습니다.");
  });
  it("원본 페이지가 없으면 승인을 막는다", () => {
    expect(findingIssues({ ...demoFinding, pageNumber: null })).toContain(
      "근거가 있는 원본 페이지를 확인해 주세요.",
    );
  });
  it("보고·사용적합성과 완제품 개선율을 구분한다", () => {
    expect(
      findingIssues({
        ...demoFinding,
        evidenceType: "safety",
        suggestedClaim: "임상 효과와 개선율을 확인했습니다.",
      }),
    ).toContain(
      "보고·사용적합성·원료 특성을 완제품의 개선율로 바꿀 수 없습니다.",
    );
  });
  it("인용문에 없는 카피 수치와 치료 표현을 차단한다", () => {
    expect(
      findingIssues({ ...demoFinding, suggestedClaim: "99.9% 변화" }),
    ).toContain("활용 카피에 인용문에 없는 수치가 있습니다.");
    expect(
      findingIssues({ ...demoFinding, suggestedClaim: "피부 질환을 치료" }),
    ).toContain("치료·안전성 보장 표현은 이 근거로 승인할 수 없습니다.");
  });
  it("같은 수치에 다른 단위를 붙이는 것도 차단한다", () => {
    expect(
      findingIssues({ ...demoFinding, suggestedClaim: "12.5mg 변화" }),
    ).toContain("결과·카피의 수치와 단위가 인용문과 일치하지 않습니다.");
  });
});
describe("상세페이지 기획 원칙", () => {
  it("승인된 근거와 하나의 마무리를 가진 구성을 허용한다", () => {
    expect(planIssues(demoPlan, product, evidence)).toEqual([]);
  });
  it("거품형 제품의 거품 구좌 누락을 막고 오일에는 강제하지 않는다", () => {
    const withoutFoam = {
      ...demoPlan,
      sections: demoPlan.sections.filter((s) => s.type !== "foam"),
    };
    expect(planIssues(withoutFoam, product, evidence)).toContain(
      "거품형 세정 제품에 거품 소구가 누락됐습니다.",
    );
    expect(
      planIssues(withoutFoam, { ...product, subtype: "오일" }, evidence),
    ).not.toContain("거품형 세정 제품에 거품 소구가 누락됐습니다.");
  });
  it("마무리 중복과 후반부 순서 위반을 차단한다", () => {
    expect(
      planIssues(
        { ...demoPlan, sections: [demoPlan.sections[4], ...demoPlan.sections] },
        product,
        evidence,
      ),
    ).toContain("마무리 구좌는 정확히 하나여야 합니다.");
    expect(
      planIssues(
        { ...demoPlan, sections: [...demoPlan.sections].reverse() },
        product,
        evidence,
      ),
    ).toContain(
      "후반부는 추천 대상 → 마무리 → 사용방법 → 제품 연출 순서여야 합니다.",
    );
  });
  it("미승인 근거와 전성분에 없는 성분을 차단한다", () => {
    expect(planIssues(demoPlan, product, [])).toContain(
      "승인되지 않은 근거가 연결됐습니다.",
    );
    expect(
      planIssues(
        {
          ...demoPlan,
          ingredientInsights: [
            { ingredient: "없는성분", role: "검토", limitation: "근거 없음" },
          ],
        },
        product,
        evidence,
      ),
    ).toContain("전성분에 없는 성분이 분석에 포함됐습니다.");
  });
  it("원본에 없는 개선율이 구좌에 들어가면 차단한다", () => {
    const sections = demoPlan.sections.map((s) =>
      s.type === "clinical" ? { ...s, body: "99.9% 개선" } : s,
    );
    expect(planIssues({ ...demoPlan, sections }, product, evidence)).toContain(
      "연결된 근거에 없는 수치·단위가 카피에 포함됐습니다.",
    );
  });
});
