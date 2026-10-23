import { z } from "zod";
import { isFoaming } from "./brief";
import {
  planIssues,
  planSchema,
  sectionIssues,
  sectionSchema,
  type Plan,
} from "./planning";

export const sectionLabels: Record<Plan["sections"][number]["type"], string> = {
  hero: "첫인상",
  problem: "고객의 고민",
  point: "제품 특징",
  foam: "거품 경험",
  clinical: "시험 근거",
  recommendation: "추천 대상",
  closing: "마무리",
  how_to_use: "사용방법",
  product_visual: "제품 연출",
};
export const citationSchema = z.object({
  id: z.uuid(),
  sourceFileId: z.uuid(),
  filename: z.string().max(1000),
  type: z.string().max(100),
  excerpt: z.string().max(20000),
  claim: z.string().max(5000).nullable(),
  page: z.number().int().positive().nullable(),
});
export const basisSchema = z.object({
  productId: z.uuid(),
  brand: z.string().max(1000),
  name: z.string().max(1000),
  category: z.string().nullable(),
  subtype: z.string().nullable(),
  ingredients: z.string().max(100000).nullable(),
});
export const documentSectionSchema = sectionSchema
  .extend({
    id: z.uuid(),
    status: z.enum(["draft", "approved"]),
    approvedBy: z.uuid().nullable(),
    approvedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine(
    (s) =>
      s.status === "approved"
        ? !!s.approvedBy && !!s.approvedAt
        : s.approvedBy === null && s.approvedAt === null,
    "승인 정보가 일치하지 않습니다.",
  );
export const planDocumentSchema = planSchema
  .extend({
    schemaVersion: z.literal(1),
    basis: basisSchema,
    sources: z.array(citationSchema).max(100),
    sections: z.array(documentSectionSchema).min(5).max(25),
  })
  .superRefine((doc, ctx) => {
    if (
      new Set(doc.sections.map((s) => s.id)).size !== doc.sections.length ||
      new Set(doc.sources.map((s) => s.id)).size !== doc.sources.length
    )
      ctx.addIssue({ code: "custom", message: "식별자가 중복됐습니다." });
    const ids = new Set(doc.sources.map((s) => s.id));
    if (doc.sections.some((s) => s.evidenceIds.some((id) => !ids.has(id))))
      ctx.addIssue({
        code: "custom",
        message: "기획서에 없는 근거가 연결됐습니다.",
      });
  });
export type PlanDocument = z.infer<typeof planDocumentSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type PlanBasis = z.infer<typeof basisSchema>;
export type DocumentSection = PlanDocument["sections"][number];
export type VersionAction =
  | "create"
  | "generate"
  | "edit"
  | "approve"
  | "unapprove"
  | "restore"
  | "regenerate_section";
export type PlanVersion = {
  id: string;
  project_id: string;
  product_id: string;
  revision: number;
  parent_id: string | null;
  restored_from: string | null;
  action: VersionAction;
  changed_section_id: string | null;
  snapshot: PlanDocument;
  created_by: string;
  created_at: string;
};
// JSON 객체의 키 순서가 달라도 같은 저장 내용으로 비교합니다.
export function sameValue(a: unknown, b: unknown): boolean {
  const normalize = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(normalize)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, val]) => [k, normalize(val)]),
          )
        : v;
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
export function createDocument(
  plan: Plan,
  basis: PlanBasis,
  sources: Citation[],
): PlanDocument {
  return planDocumentSchema.parse({
    ...plan,
    schemaVersion: 1,
    basis,
    sources,
    sections: plan.sections.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      status: "draft",
      approvedBy: null,
      approvedAt: null,
    })),
  });
}
export function manualPlan(basis: PlanBasis): Plan {
  const types: Plan["sections"][number]["type"][] = [
    "hero",
    "problem",
    "point",
  ];
  if (isFoaming(basis.category ?? "", basis.subtype ?? "")) types.push("foam");
  types.push("recommendation", "closing", "how_to_use", "product_visual");
  return {
    coreUsp: "[작성 필요] 핵심 구매 이유",
    strategy: "[작성 필요] 제품과 고객을 연결할 기획 전략",
    ingredientInsights: [],
    cautions: [
      "직접 기획으로 시작한 문서입니다. 제품 라벨과 승인된 근거를 확인해 내용을 작성하세요.",
    ],
    sections: types.map((type) => ({
      type,
      headline: `[작성 필요] ${sectionLabels[type]}`,
      body:
        type === "product_visual"
          ? ""
          : "[작성 필요] 확인된 제품 정보로 작성해 주세요.",
      visualGuide: "[작성 필요] 필요한 촬영·소재·레이아웃을 적어 주세요.",
      evidenceIds: [],
    })),
  };
}
export function approveIssues(
  section: DocumentSection,
  doc: PlanDocument,
): string[] {
  const issues = sectionIssues(
    section,
    doc.sources.map((s) => ({ id: s.id, source_excerpt: s.excerpt })),
  );
  if (
    [section.headline, section.body, section.visualGuide].some((v) =>
      v.includes("[작성 필요]"),
    )
  )
    issues.push("작성 필요 문구를 실제 내용으로 바꿔 주세요.");
  if (section.type !== "product_visual" && !section.body.trim())
    issues.push("본문을 작성해 주세요.");
  return issues;
}
export function editDocument(base: PlanDocument, input: unknown): PlanDocument {
  const next = planDocumentSchema.parse(input);
  if (
    !sameValue(base.basis, next.basis) ||
    !sameValue(base.sources, next.sources)
  )
    throw new Error(
      "기준 브리프와 원본 근거는 바꿀 수 없습니다. 새 기획을 시작해 주세요.",
    );
  if (base.sections.length !== next.sections.length)
    throw new Error("구좌 수를 바꿀 수 없습니다.");
  base.sections.forEach((before, i) => {
    const after = next.sections[i];
    if (
      before.id !== after.id ||
      before.type !== after.type ||
      before.status !== after.status ||
      before.approvedBy !== after.approvedBy ||
      before.approvedAt !== after.approvedAt
    )
      throw new Error("구좌 순서·종류·승인은 별도로 관리합니다.");
    if (before.status === "approved" && !sameValue(before, after))
      throw new Error("승인한 구좌는 먼저 승인을 해제해야 수정할 수 있습니다.");
  });
  return next;
}
export function changeApproval(
  base: PlanDocument,
  sectionId: string,
  approve: boolean,
  userId: string,
): PlanDocument {
  const next = structuredClone(base);
  const section = next.sections.find((s) => s.id === sectionId);
  if (!section || (section.status === "approved") === approve)
    throw new Error("구좌의 현재 승인 상태를 확인해 주세요.");
  if (approve) {
    const issues = approveIssues(section, next);
    if (issues.length) throw new Error(issues.join(" "));
  }
  section.status = approve ? "approved" : "draft";
  section.approvedBy = approve ? userId : null;
  section.approvedAt = approve ? new Date().toISOString() : null;
  return next;
}
export function replaceSection(
  base: PlanDocument,
  sectionId: string,
  input: unknown,
): PlanDocument {
  const before = base.sections.find((s) => s.id === sectionId);
  if (!before || before.status === "approved")
    throw new Error("승인 전 구좌만 재생성할 수 있습니다.");
  const content = sectionSchema.parse(input);
  if (content.type !== before.type)
    throw new Error("구좌 종류를 바꿀 수 없습니다.");
  const issues = sectionIssues(
    content,
    base.sources.map((s) => ({ id: s.id, source_excerpt: s.excerpt })),
  );
  if (issues.length) throw new Error(issues.join(" "));
  const next = structuredClone(base);
  next.sections = next.sections.map((s) =>
    s.id === sectionId ? { ...s, ...content } : s,
  );
  return planDocumentSchema.parse(next);
}
export function finalIssues(doc: PlanDocument): string[] {
  const issues = planIssues(
    doc,
    doc.basis,
    doc.sources.map((s) => ({
      id: s.id,
      source_excerpt: s.excerpt,
      suggested_claim: s.claim,
    })),
  );
  issues.push(
    ...sectionIssues(
      {
        type: "point",
        headline: doc.coreUsp,
        body: doc.strategy,
        visualGuide: "",
        evidenceIds: [...new Set(doc.sections.flatMap((s) => s.evidenceIds))],
      },
      doc.sources.map((s) => ({ id: s.id, source_excerpt: s.excerpt })),
    ),
  );
  if (doc.sections.some((s) => s.status !== "approved"))
    issues.push("승인하지 않은 구좌가 있습니다.");
  if ([doc.coreUsp, doc.strategy].some((v) => v.includes("[작성 필요]")))
    issues.push("핵심 구매 이유와 기획 전략을 작성해 주세요.");
  doc.sections.forEach((s) => issues.push(...approveIssues(s, doc)));
  return [...new Set(issues)];
}
