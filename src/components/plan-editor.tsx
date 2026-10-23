"use client";
import { useState } from "react";
import {
  approveIssues,
  finalIssues,
  sectionLabels,
  type PlanDocument,
  type PlanVersion,
} from "@/lib/plan-document";
export function PlanEditor({
  version,
  draft,
  onChange,
  onApproval,
  busy,
  locked,
  dirty,
  canRegenerate,
  onRegenerate,
}: {
  version: PlanVersion;
  draft: PlanDocument;
  onChange: (doc: PlanDocument) => void;
  onApproval: (id: string, approve: boolean) => void;
  busy: boolean;
  locked: boolean;
  dirty: boolean;
  canRegenerate: boolean;
  onRegenerate: (id: string, instruction: string) => void;
}) {
  const [instructions, setInstructions] = useState<Record<string, string>>({});
  const approved = draft.sections.filter((s) => s.status === "approved").length;
  const issues = finalIssues(draft);
  function sectionChange(
    index: number,
    patch: Partial<PlanDocument["sections"][number]>,
  ) {
    onChange({
      ...draft,
      sections: draft.sections.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  }
  return (
    <div className="planning-editor">
      <section className="panel plan-overview">
        <span className="eyebrow">
          {version.snapshot.basis.brand} · 버전 {version.revision}
        </span>
        <h2>{draft.basis.name}</h2>
        <p className="small muted">
          이 버전을 시작할 때 저장한 제품 브리프와 근거를 기준으로 작업합니다.
          브리프를 바꿨다면 새 기획을 시작해 주세요.
        </p>
        <div className="plan-progress">
          <strong>
            {approved} / {draft.sections.length} 구좌 승인
          </strong>
          <progress
            aria-label="구좌 승인 진행률"
            value={approved}
            max={draft.sections.length}
          />
        </div>
        <fieldset disabled={busy || locked} className="plan-fields">
          <label>
            핵심 구매 이유
            <textarea
              rows={3}
              maxLength={2000}
              value={draft.coreUsp}
              onChange={(e) => onChange({ ...draft, coreUsp: e.target.value })}
            />
          </label>
          <label>
            기획 전략
            <textarea
              rows={4}
              maxLength={2000}
              value={draft.strategy}
              onChange={(e) => onChange({ ...draft, strategy: e.target.value })}
            />
          </label>
        </fieldset>
        <details>
          <summary>기준 전성분과 성분 검토</summary>
          <p className="small">{draft.basis.ingredients}</p>
          {draft.ingredientInsights.length ? (
            draft.ingredientInsights.map((i, index) => (
              <div key={index}>
                <strong>{i.ingredient}</strong>
                <p>{i.role}</p>
                <p className="small muted">{i.limitation}</p>
              </div>
            ))
          ) : (
            <p className="small muted">
              아직 성분 검토가 없습니다. 원료의 일반적 특성과 완제품의 효능은
              구분해 검토해야 합니다.
            </p>
          )}
        </details>
        <details>
          <summary>최종 검토 항목 {issues.length}개</summary>
          {issues.length ? (
            <ul className="small muted">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : (
            <p className="small">모든 구좌의 승인을 확인했습니다.</p>
          )}
        </details>
      </section>
      {draft.sections.map((section, index) => {
        const checks = approveIssues(section, draft);
        const sectionLocked = busy || locked || section.status === "approved";
        return (
          <article
            key={section.id}
            className={`panel plan-edit-card ${section.status === "approved" ? "is-approved" : ""}`}
            aria-label={`구좌 ${index + 1} ${sectionLabels[section.type]}`}
          >
            <div className="plan-card-heading">
              <div>
                <span className="eyebrow">
                  구좌 {index + 1} · {sectionLabels[section.type]}
                </span>
                <h3>{section.headline || "제목을 작성해 주세요"}</h3>
              </div>
              <span className="badge">
                {section.status === "approved" ? "승인됨" : "작성 중"}
              </span>
            </div>
            <fieldset disabled={sectionLocked} className="plan-fields">
              <label>
                구좌 {index + 1} 제목
                <input
                  maxLength={200}
                  value={section.headline}
                  onChange={(e) =>
                    sectionChange(index, { headline: e.target.value })
                  }
                />
              </label>
              <label>
                구좌 {index + 1} 본문
                <textarea
                  rows={4}
                  maxLength={3000}
                  value={section.body}
                  onChange={(e) =>
                    sectionChange(index, { body: e.target.value })
                  }
                />
              </label>
              <label>
                구좌 {index + 1} 비주얼 가이드
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={section.visualGuide}
                  onChange={(e) =>
                    sectionChange(index, { visualGuide: e.target.value })
                  }
                />
              </label>
              <div>
                <strong className="small">연결할 승인 근거</strong>
                {draft.sources.length ? (
                  draft.sources.map((source) => (
                    <label className="check-label plan-source" key={source.id}>
                      <input
                        type="checkbox"
                        checked={section.evidenceIds.includes(source.id)}
                        onChange={(e) =>
                          sectionChange(index, {
                            evidenceIds: e.target.checked
                              ? [...section.evidenceIds, source.id]
                              : section.evidenceIds.filter(
                                  (id) => id !== source.id,
                                ),
                          })
                        }
                      />
                      <span>
                        {source.filename} ·{" "}
                        {source.page ? `${source.page}쪽` : "페이지 미확인"}
                        <small>
                          {source.claim ?? source.excerpt.slice(0, 140)}
                        </small>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="small muted">
                    연결할 승인 근거가 없습니다. 자료 분석에서 원문을
                    검토·승인한 뒤 새 기획을 시작하면 반영됩니다.
                  </p>
                )}
              </div>
            </fieldset>
            {section.evidenceIds.length > 0 && (
              <details>
                <summary>연결한 원문 인용 보기</summary>
                {section.evidenceIds.map((id) => {
                  const source = draft.sources.find((s) => s.id === id)!;
                  return (
                    <blockquote key={id}>
                      <strong>
                        {source.filename} · {source.page}쪽
                      </strong>
                      <p>{source.excerpt}</p>
                    </blockquote>
                  );
                })}
              </details>
            )}
            {section.status === "approved" ? (
              <p className="small muted">
                승인 시각:{" "}
                {new Date(section.approvedAt!).toLocaleString("ko-KR")} ·
                승인자: {section.approvedBy}
              </p>
            ) : (
              checks.length > 0 && (
                <ul
                  className="small muted"
                  aria-label={`구좌 ${index + 1} 승인 전 확인`}
                >
                  {checks.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )
            )}
            <button
              className="button secondary small-button"
              type="button"
              disabled={
                busy ||
                locked ||
                dirty ||
                (section.status !== "approved" && checks.length > 0)
              }
              onClick={() =>
                onApproval(section.id, section.status !== "approved")
              }
            >
              {section.status === "approved"
                ? "승인 해제하고 수정"
                : "내용 확인 후 구좌 승인"}
            </button>
            {section.status === "draft" && !locked && (
              <div className="plan-regenerate">
                <label className="small">
                  구좌 {index + 1} 수정 요청
                  <textarea
                    aria-label={`구좌 ${index + 1} 수정 요청`}
                    rows={2}
                    maxLength={1000}
                    disabled={busy || !canRegenerate}
                    value={instructions[section.id] ?? ""}
                    onChange={(e) =>
                      setInstructions((rows) => ({
                        ...rows,
                        [section.id]: e.target.value,
                      }))
                    }
                    placeholder="예: 같은 근거로 카피를 더 간결하게"
                  />
                </label>
                <button
                  className="button secondary small-button"
                  disabled={busy || dirty || !canRegenerate}
                  onClick={() =>
                    onRegenerate(section.id, instructions[section.id] ?? "")
                  }
                >
                  이 구좌만 AI 재생성
                </button>
                <p className="small muted">
                  다른 구좌의 내용과 승인은 유지됩니다. AI 사용 동의와 저장을
                  마친 후 사용할 수 있습니다.
                </p>
              </div>
            )}
            {dirty && !locked && (
              <span className="small muted">
                {" "}
                변경 내용을 저장한 뒤 승인할 수 있습니다.
              </span>
            )}
          </article>
        );
      })}
      <section className="panel">
        <h3>제작 시 주의사항</h3>
        <ul>
          {draft.cautions.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
        <p className="small muted">
          최종 카피의 사실 여부와 표시·광고 적합성은 원문 및 제품 라벨과 대조해
          확인해 주세요.
        </p>
      </section>
    </div>
  );
}
