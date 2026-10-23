import { describe, expect, it } from "vitest";
import { ingredientNames } from "@/lib/ingredients";
import { planIssues } from "@/lib/planning";
import { demoPlan, demoEvidence } from "@/lib/analysis-demo";
describe("전성분의 숫자 위치 표기", () => {
  it("화학 성분명 내부 쉼표를 보존하고 보통 구분자는 분리한다", () => {
    expect(
      ingredientNames(
        "정제수,글리세린, 1,2-헥산다이올; 1,2,3-트라이올\n판테놀",
      ),
    ).toEqual([
      "정제수",
      "글리세린",
      "1,2-헥산다이올",
      "1,2,3-트라이올",
      "판테놀",
    ]);
  });
  it("전각 쉼표와 숫자 위치의 공백을 정규화한다", () => {
    expect(ingredientNames("정제수，1， 2-헥산다이올")).toEqual([
      "정제수",
      "1,2-헥산다이올",
    ]);
  });
  it("전성분에 있는 숫자 위치 성분을 허용하되 다른 성분을 만들어 허용하지 않는다", () => {
    const p = {
      category: "페이스 클렌징",
      subtype: "폼",
      ingredients: "정제수, 글리세린, 1,2-헥산다이올",
    };
    const plan = {
      ...demoPlan,
      ingredientInsights: [
        {
          ingredient: "1,2-헥산다이올",
          role: "원료 역할 검토",
          limitation: "완제품 효능과 구분",
        },
      ],
    };
    expect(planIssues(plan, p, [demoEvidence])).toEqual([]);
    plan.ingredientInsights[0].ingredient = "2-헥산다이올";
    expect(planIssues(plan, p, [demoEvidence])).toContain(
      "전성분에 없는 성분이 분석에 포함됐습니다.",
    );
  });
});
