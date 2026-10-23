import { finalIssues, sectionLabels, type PlanVersion } from "./plan-document";
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ]!,
  );
export function exportPlanHtml(version: PlanVersion): string {
  const doc = version.snapshot;
  const issues = finalIssues(doc);
  const label = issues.length ? "검토용 기획서" : "승인 완료 기획서";
  const p = (s: string) => `<p>${escape(s)}</p>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(doc.basis.name)} — ${label}</title><style>body{font-family:system-ui,sans-serif;color:#22332e;max-width:900px;margin:40px auto;padding:24px;line-height:1.8}h1,h2,h3{line-height:1.4}article{break-inside:avoid;border-top:1px solid #ccc;padding:24px 0}p,blockquote{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#52635a}blockquote{border-left:3px solid #8ca58c;padding-left:16px}aside{background:#edf2e8;padding:16px}@media print{body{margin:0;padding:10mm}}</style></head><body><small>${label} · 버전 ${version.revision}</small><h1>${escape(doc.basis.brand)} / ${escape(doc.basis.name)}</h1>${p(`저장 시각: ${version.created_at} · 버전 ID: ${version.id}`)}<aside>${issues.length ? `검토할 항목<ul>${issues.map((i) => `<li>${escape(i)}</li>`).join("")}</ul>` : "모든 구좌의 승인을 확인했습니다. 제작 전 제품 정보와 원문을 최종 확인해 주세요."}</aside><h2>핵심 구매 이유</h2>${p(doc.coreUsp)}<h2>기획 전략</h2>${p(doc.strategy)}<h2>기준 제품 브리프</h2>${p(`${doc.basis.category ?? ""} / ${doc.basis.subtype ?? ""}`)}${p(`전성분: ${doc.basis.ingredients ?? ""}`)}<h2>성분 검토</h2>${doc.ingredientInsights.map((i) => `<h3>${escape(i.ingredient)}</h3>${p(i.role)}${p(i.limitation)}`).join("")}${doc.sections
    .map(
      (s, i) =>
        `<article><small>구좌 ${i + 1} · ${sectionLabels[s.type]} · ${s.status === "approved" ? "승인됨" : "검토 대기"}</small><h2>${escape(s.headline)}</h2>${p(s.body)}<h3>비주얼 가이드</h3>${p(s.visualGuide)}${s.status === "approved" ? `<small>승인자: ${escape(s.approvedBy)} · ${escape(s.approvedAt)}</small>` : ""}${s.evidenceIds
          .map((id) => {
            const source = doc.sources.find((e) => e.id === id)!;
            return `<blockquote><strong>${escape(source.filename)} · ${source.page ? `${source.page}쪽` : "페이지 미확인"}</strong>${p(source.excerpt)}<small>근거 ID: ${escape(source.id)}</small></blockquote>`;
          })
          .join("")}</article>`,
    )
    .join(
      "",
    )}<h2>제작 시 주의사항</h2><ul>${doc.cautions.map((c) => `<li>${escape(c)}</li>`).join("")}</ul></body></html>`;
}
