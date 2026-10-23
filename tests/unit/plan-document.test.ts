import { describe, expect, it } from "vitest";
import { demoEvidence, demoFile, demoPlan } from "@/lib/analysis-demo";
import {
  approveIssues,
  changeApproval,
  createDocument,
  editDocument,
  finalIssues,
  manualPlan,
  sameValue,
  type PlanBasis,
  type PlanVersion,
} from "@/lib/plan-document";
import { exportPlanHtml } from "@/lib/plan-export";
const user = "b1000000-0000-4000-8000-000000000001";
const basis: PlanBasis = {
  productId: "b2000000-0000-4000-8000-000000000001",
  brand: "검증 브랜드",
  name: "검증 제품",
  category: "페이스 클렌징",
  subtype: "폼",
  ingredients: "정제수, 글리세린",
};
export const fixtureDocument = () =>
  createDocument(demoPlan, basis, [
    {
      id: demoEvidence.id,
      sourceFileId: demoFile.id,
      filename: demoFile.filename,
      type: "clinical",
      excerpt: demoEvidence.source_excerpt,
      claim: demoEvidence.suggested_claim,
      page: 3,
    },
  ]);
describe("기획서 편집과 승인", () => {
  it("직접 기획은 거품 제품의 필수 구좌와 후반 순서를 유지하고 가상 효능을 넣지 않는다", () => {
    const plan = manualPlan(basis);
    expect(plan.sections.some((s) => s.type === "foam")).toBe(true);
    expect(plan.sections.slice(-4).map((s) => s.type)).toEqual([
      "recommendation",
      "closing",
      "how_to_use",
      "product_visual",
    ]);
    expect(
      manualPlan({ ...basis, subtype: "오일" }).sections.some(
        (s) => s.type === "foam",
      ),
    ).toBe(false);
    const doc = createDocument(plan, basis, []);
    expect(approveIssues(doc.sections[0], doc)).toContain(
      "작성 필요 문구를 실제 내용으로 바꿔 주세요.",
    );
  });
  it("승인 시 다른 구좌·원문·기준 브리프를 보존하고 기존 객체를 수정하지 않는다", () => {
    const doc = fixtureDocument();
    const before = structuredClone(doc);
    const approved = changeApproval(doc, doc.sections[0].id, true, user);
    expect(doc).toEqual(before);
    expect(approved.sections[0].approvedBy).toBe(user);
    expect(approved.sections.slice(1)).toEqual(before.sections.slice(1));
    expect(approved.sources).toEqual(doc.sources);
    expect(approved.basis).toEqual(doc.basis);
  });
  it("승인된 구좌를 편집하거나 승인자를 바꿀 수 없다", () => {
    const doc = fixtureDocument();
    const base = changeApproval(doc, doc.sections[0].id, true, user);
    const tampered = structuredClone(base);
    tampered.sections[0].headline = "수정";
    expect(() => editDocument(base, tampered)).toThrow("먼저 승인을 해제");
    tampered.sections[0].approvedBy = "b3000000-0000-4000-8000-000000000001";
    expect(() => editDocument(base, tampered)).toThrow();
  });
  it("승인 해제 후 해당 구좌만 수정할 수 있다", () => {
    const doc = fixtureDocument();
    const approved = changeApproval(doc, doc.sections[0].id, true, user);
    const unlocked = changeApproval(approved, doc.sections[0].id, false, user);
    const next = structuredClone(unlocked);
    next.sections[0].headline = "바꾼 제목";
    expect(editDocument(unlocked, next).sections[0].headline).toBe("바꾼 제목");
    expect(approved.sections[0].status).toBe("approved");
  });
  it("구좌 교체·순서 변경·근거 인용 위조를 거절한다", () => {
    const doc = fixtureDocument();
    const shuffled = structuredClone(doc);
    [shuffled.sections[0], shuffled.sections[1]] = [
      shuffled.sections[1],
      shuffled.sections[0],
    ];
    expect(() => editDocument(doc, shuffled)).toThrow();
    const forged = structuredClone(doc);
    forged.sources[0].excerpt = "가짜 근거";
    expect(() => editDocument(doc, forged)).toThrow("원본 근거");
  });
  it("수치가 연결 원문에 없거나 시험 근거 연결이 없으면 승인할 수 없다", () => {
    const doc = fixtureDocument();
    const clinical = doc.sections.find((s) => s.type === "clinical")!;
    clinical.body = "개선 지표 99.9%";
    expect(() => changeApproval(doc, clinical.id, true, user)).toThrow(
      "수치·단위",
    );
    clinical.body = "시험 결과";
    clinical.evidenceIds = [];
    expect(() => changeApproval(doc, clinical.id, true, user)).toThrow(
      "승인된 근거",
    );
  });
  it("JSON 키 순서가 달라도 변경으로 보지 않는다", () => {
    expect(
      sameValue({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }),
    ).toBe(true);
  });
});
describe("제작용 내보내기", () => {
  const version = (): PlanVersion => ({
    id: crypto.randomUUID(),
    project_id: crypto.randomUUID(),
    product_id: basis.productId,
    revision: 1,
    parent_id: null,
    restored_from: null,
    action: "create",
    changed_section_id: null,
    snapshot: fixtureDocument(),
    created_by: user,
    created_at: new Date().toISOString(),
  });
  it("미승인 문서는 검토용으로 표시하고 원본 페이지와 인용을 함께 내보낸다", () => {
    const html = exportPlanHtml(version());
    expect(html).toContain("검토용 기획서");
    expect(html).toContain("3쪽");
    expect(html).toContain(demoEvidence.source_excerpt);
    expect(html).toContain("default-src 'none'");
  });
  it("사용자와 문서에 들어 있는 HTML·스크립트·이벤트 속성을 문자로 이스케이프한다", () => {
    const v = version();
    v.snapshot.sections[0].headline = '<img src=x onerror="alert(1)">';
    v.snapshot.sources[0].filename = "</strong><script>alert(1)</script>";
    const html = exportPlanHtml(v);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });
  it("전체 승인 완료 여부와 최종 구성 검증을 함께 확인한다", () => {
    const v = version();
    for (const s of v.snapshot.sections)
      v.snapshot = changeApproval(v.snapshot, s.id, true, user);
    expect(finalIssues(v.snapshot)).toEqual([]);
    expect(exportPlanHtml(v)).toContain("승인 완료 기획서");
    v.snapshot.sections[0].status = "draft";
    v.snapshot.sections[0].approvedAt = null;
    v.snapshot.sections[0].approvedBy = null;
    expect(exportPlanHtml(v)).toContain("검토용 기획서");
  });
});
