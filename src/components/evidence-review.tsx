"use client";
import { useState } from "react";
import {
  decodeFinding,
  evidenceLabels,
  findingIssues,
  type Finding,
} from "@/lib/analysis";
import type { Tables } from "@/lib/database.types";

export function EvidenceReview({
  evidence,
  filename,
  busy,
  enabled,
  demo,
  onReview,
  onOpen,
}: {
  evidence: Tables<"evidence">;
  filename: string;
  busy: boolean;
  enabled: boolean;
  demo: boolean;
  onReview: (
    id: string,
    finding: Finding,
    decision: "approved" | "rejected",
    checked: boolean,
  ) => void;
  onOpen: () => void;
}) {
  const stored = decodeFinding(evidence.extracted_result);
  const initial = stored
    ? decodeFinding({
        ...stored,
        evidenceType: evidence.evidence_type,
        pageNumber: evidence.page_number,
        sourceExcerpt: evidence.source_excerpt,
        suggestedClaim: evidence.suggested_claim,
      })
    : null;
  const [finding, setFinding] = useState(initial);
  const [checked, setChecked] = useState(false);
  if (!finding)
    return (
      <article className="panel">
        <h3>{filename}</h3>
        <p>
          이전 형식의 근거입니다. 원본을 확인하고 관리자에게 형식 검토를 요청해
          주세요.
        </p>
      </article>
    );
  const locked = evidence.review_status !== "pending";
  const issues = findingIssues(finding);
  function change(next: Finding) {
    setFinding(next);
    setChecked(false);
  }
  return (
    <article className="panel evidence-card">
      <div className="list-heading">
        <div>
          <span className="eyebrow">
            {evidenceLabels[finding.evidenceType]}
          </span>
          <h3>{finding.studyName ?? "시험명 확인 필요"}</h3>
        </div>
        <span
          className={`badge ${evidence.review_status === "rejected" ? "danger" : ""}`}
        >
          {(
            {
              pending: "검토 대기",
              approved: "승인됨",
              rejected: "제외됨",
            } as Record<string, string>
          )[evidence.review_status] ?? "확인 필요"}
        </span>
      </div>
      <p className="small muted">
        {filename} ·{" "}
        {finding.pageNumber ? `${finding.pageNumber}쪽` : "페이지 확인 필요"}
      </p>
      {!demo && (
        <button
          className="button secondary"
          type="button"
          onClick={onOpen}
          disabled={busy}
        >
          원본 열기
        </button>
      )}
      <fieldset disabled={locked || busy || !enabled}>
        <legend className="visually-hidden">추출된 근거 검토</legend>
        <div className="form-grid">
          {(["studyName", "institution", "subjects", "duration"] as const).map(
            (key) => (
              <label key={key}>
                {
                  {
                    studyName: "시험명",
                    institution: "시험기관",
                    subjects: "시험 대상",
                    duration: "시험 기간",
                  }[key]
                }
                <input
                  value={finding[key] ?? ""}
                  onChange={(e) =>
                    change({ ...finding, [key]: e.target.value || null })
                  }
                />
              </label>
            ),
          )}
          <label>
            원본 페이지
            <input
              type="number"
              min="1"
              max="10000"
              value={finding.pageNumber ?? ""}
              onChange={(e) =>
                change({
                  ...finding,
                  pageNumber: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </label>
          <label>
            근거 종류
            <select
              value={finding.evidenceType}
              onChange={(e) =>
                change({
                  ...finding,
                  evidenceType: e.target.value as Finding["evidenceType"],
                })
              }
            >
              {Object.entries(evidenceLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          원문 인용
          <textarea
            rows={4}
            value={finding.sourceExcerpt}
            onChange={(e) =>
              change({ ...finding, sourceExcerpt: e.target.value })
            }
          />
        </label>
        <label>
          시험 결과
          <textarea
            rows={2}
            value={finding.result}
            onChange={(e) => change({ ...finding, result: e.target.value })}
          />
        </label>
        {finding.measurements.map((measurement, index) => (
          <div className="measurement-grid" key={index}>
            {(["metric", "value", "unit"] as const).map((key) => (
              <label key={key}>
                {{ metric: "측정 항목", value: "수치", unit: "단위" }[key]}
                <input
                  value={measurement[key]}
                  onChange={(e) =>
                    change({
                      ...finding,
                      measurements: finding.measurements.map((m, i) =>
                        i === index ? { ...m, [key]: e.target.value } : m,
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
        ))}
        <label>
          활용 카피 후보
          <textarea
            rows={2}
            value={finding.suggestedClaim ?? ""}
            onChange={(e) =>
              change({ ...finding, suggestedClaim: e.target.value || null })
            }
          />
        </label>
        {!!finding.limitations.length && (
          <ul className="small muted">
            {finding.limitations.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
        {!locked && (
          <>
            {issues.length > 0 && (
              <ul className="notice error" aria-label="근거 검토 필요 항목">
                {issues.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            <p className="small muted">
              자동 검사는 입력된 인용문 안의 수치·단위를 비교합니다. 원본과
              일치하는지는 직접 확인해야 합니다.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              {demo
                ? "체험: 원본과 대조하는 검토 과정을 이해했습니다."
                : "원본 페이지에서 시험 대상·기간·결과·수치·단위를 직접 확인했습니다."}
            </label>
            <div className="analysis-actions">
              <button
                type="button"
                className="button primary"
                disabled={!checked || issues.length > 0}
                onClick={() =>
                  onReview(evidence.id, finding, "approved", checked)
                }
              >
                {demo ? "체험에서 승인하기" : "근거 승인"}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  onReview(evidence.id, finding, "rejected", false)
                }
              >
                기획에서 제외
              </button>
            </div>
          </>
        )}
      </fieldset>
      {locked && (
        <p className="small muted">
          검토한 근거는 이 화면에서 덮어쓰지 않습니다. 새 분석 결과는 별도의
          검토 대기 근거로 등록됩니다.
        </p>
      )}
    </article>
  );
}
