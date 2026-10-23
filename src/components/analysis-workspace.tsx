"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EvidenceReview } from "./evidence-review";
import { findingIssues, type Finding } from "@/lib/analysis";
import { demoPlan } from "@/lib/analysis-demo";
import type { Plan } from "@/lib/planning";
import type { Tables } from "@/lib/database.types";
type Job = Pick<
  Tables<"analysis_jobs">,
  "id" | "source_file_id" | "status" | "error_message" | "created_at"
>;
export function AnalysisWorkspace({
  projectId,
  productId,
  files,
  evidence,
  jobs,
  aiReady,
  writeReady,
  demo = false,
}: {
  projectId: string;
  productId: string | null;
  files: Tables<"source_files">[];
  evidence: Tables<"evidence">[];
  jobs: Job[];
  aiReady: boolean;
  writeReady: boolean;
  demo?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [localEvidence, setLocalEvidence] = useState(evidence);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [consent, setConsent] = useState(false);
  const entries = demo ? localEvidence : evidence;
  const approved = entries.filter((e) => e.review_status === "approved").length;
  async function request(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error ?? "요청을 완료하지 못했습니다.");
    return data;
  }
  function act(work: () => Promise<void>) {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        await work();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "요청을 완료하지 못했습니다.",
        );
      }
    });
  }
  function review(
    id: string,
    finding: Finding,
    decision: "approved" | "rejected",
    checked: boolean,
  ) {
    act(async () => {
      if (demo) {
        if (
          decision === "approved" &&
          (!checked || findingIssues(finding).length)
        )
          throw new Error("검토 필요 항목을 확인해 주세요.");
        setLocalEvidence((rows) =>
          rows.map((row) =>
            row.id === id
              ? {
                  ...row,
                  review_status: decision,
                  extracted_result: { ...finding },
                  source_excerpt: finding.sourceExcerpt,
                  suggested_claim: finding.suggestedClaim,
                  page_number: finding.pageNumber,
                }
              : row,
          ),
        );
        setMessage(
          "체험 화면 안에서 검토 상태를 바꿨습니다. 서버에는 저장하지 않았습니다.",
        );
      } else {
        await request("/api/analysis", {
          operation: "review",
          projectId,
          evidenceId: id,
          finding,
          decision,
          sourceChecked: checked,
        });
        setMessage("검토 결과를 저장했습니다.");
        router.refresh();
      }
    });
  }
  function downloadPlan() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            example: demo,
            createdAt: new Date().toISOString(),
            projectId,
            productId,
            plan,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = demo
      ? "체험용_기획예시.json"
      : "상세페이지_기획초안.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="analysis-layout">
      {demo ? (
        <p className="notice">
          화면 체험입니다. 문서·수치·기획은 모두 가상 예시이며 실제 AI 분석
          결과가 아닙니다. 입력 내용과 승인은 서버에 저장되지 않습니다.
        </p>
      ) : (
        (!aiReady || !writeReady) && (
          <p className="notice">
            AI 분석 연결을 준비하고 있습니다. 업로드한 원본은 자료 탭에서 계속
            관리할 수 있습니다.
          </p>
        )
      )}
      <div className="analysis-summary panel">
        <div>
          <span className="eyebrow">원본에서 근거로</span>
          <h2>확인된 사실만, 기획에 담으세요.</h2>
          <p className="small muted">
            자동 추출 → 원문 대조 → 근거 승인 → 기획 초안
          </p>
        </div>
        <span className="badge">승인된 근거 {approved}개</span>
      </div>
      {!demo && (
        <section className="panel">
          <h3>자료 분석</h3>
          <p className="small muted">
            분석을 시작하면 선택한 원본이 Vercel AI Gateway와 연결된 모델
            제공사로 전송됩니다. 사용량에 따라 비용이 발생할 수 있습니다.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            선택한 자료의 AI 분석과 승인된 근거를 이용한 기획 생성을 진행합니다.
          </label>
          {!files.length && (
            <p className="small muted">
              자료 탭에서 PDF나 이미지를 먼저 업로드해 주세요.
            </p>
          )}
          {files.map((file) => {
            const job = jobs.find((job) => job.source_file_id === file.id);
            return (
              <div className="analysis-file" key={file.id}>
                <div>
                  <strong>{file.filename}</strong>
                  {job && (
                    <p className="small muted">
                      {
                        (
                          {
                            running: "분석 중",
                            queued: "대기 중",
                            completed: "분석 완료 · 근거 검토 필요",
                            failed: "분석 실패 · 다시 시도할 수 있습니다.",
                          } as Record<string, string>
                        )[job.status]
                      }
                      {job.error_message && ` · ${job.error_message}`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="button secondary"
                  disabled={
                    pending ||
                    !consent ||
                    !aiReady ||
                    !writeReady ||
                    !["uploaded", "analyzed"].includes(file.status)
                  }
                  onClick={() =>
                    act(async () => {
                      const result = await request("/api/analysis", {
                        operation: "analyze",
                        projectId,
                        fileId: file.id,
                        consent: true,
                      });
                      setMessage(
                        [
                          `근거 ${result.findings}개를 추출했습니다. 원본과 대조한 뒤 승인해 주세요.`,
                          ...(result.warnings ?? []),
                          result.notice ?? "",
                        ]
                          .filter(Boolean)
                          .join(" "),
                      );
                      router.refresh();
                    })
                  }
                >
                  {pending
                    ? "처리 중…"
                    : job?.status === "completed"
                      ? "새로 분석"
                      : "분석 시작"}
                </button>
              </div>
            );
          })}
        </section>
      )}
      <div aria-live="polite">
        {message && <p className="notice">{message}</p>}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {pending && (
          <p className="small muted">
            처리 중입니다. 이 화면에서 잠시 기다려 주세요.
          </p>
        )}
      </div>
      <div className="list-heading">
        <h2>
          원문과 대조할 근거 <span className="count">{entries.length}</span>
        </h2>
      </div>
      {!entries.length && (
        <div className="panel empty-state">
          <h3>아직 추출된 근거가 없습니다.</h3>
          <p>
            자료 분석이 완료되면 원본 페이지와 추출 결과를 여기서 검토할 수
            있습니다.
          </p>
        </div>
      )}
      {entries.map((item) => (
        <EvidenceReview
          key={item.id + item.review_status}
          evidence={item}
          filename={
            files.find((file) => file.id === item.source_file_id)?.filename ??
            "원본 자료"
          }
          busy={pending}
          enabled={writeReady || demo}
          demo={demo}
          onReview={review}
          onOpen={() =>
            act(async () => {
              const file = files.find(
                (file) => file.id === item.source_file_id,
              );
              if (!file) throw new Error("원본을 찾을 수 없습니다.");
              const result = await request("/api/files", {
                operation: "download",
                projectId,
                fileId: file.id,
              });
              const anchor = document.createElement("a");
              anchor.href = result.url;
              anchor.rel = "noopener";
              anchor.click();
            })
          }
        />
      ))}
      {!demo ? (
        <section className="panel planning-panel">
          <span className="eyebrow">상세페이지의 이야기</span>
          <h2>기획서를 작성하고 버전으로 보관하세요.</h2>
          <p className="small muted">
            기획서 편집에서 직접 작성하거나 승인된 근거를 바탕으로 AI 초안을
            만들 수 있습니다.
          </p>
          <Link
            className="button primary"
            href={`/workspace/${projectId}?tab=planning`}
          >
            기획서 편집으로 이동
          </Link>
        </section>
      ) : (
        <section className="panel planning-panel">
          <span className="eyebrow">상세페이지의 이야기</span>
          <h2>승인된 근거로 기획 초안을 만드세요.</h2>
          <p className="small muted">
            전성분과 제품 특징을 함께 분석합니다. 초안은 서버에 저장되지
            않으므로 내려받아 보관해 주세요. 구좌별 수정·승인·버전 저장은 다음
            단계입니다.
          </p>
          <button
            type="button"
            className="button primary"
            disabled={
              pending ||
              !approved ||
              (!demo && (!productId || !aiReady || !consent))
            }
            onClick={() =>
              act(async () => {
                if (demo) {
                  setPlan(demoPlan);
                  setMessage(
                    "체험용으로 미리 작성한 기획 예시입니다. AI를 호출하지 않았습니다.",
                  );
                } else {
                  const result = await request("/api/planning", {
                    projectId,
                    productId,
                    consent: true,
                  });
                  setPlan(result.plan);
                  setMessage(
                    "기획 초안을 만들었습니다. 카피와 근거를 확인해 내려받으세요.",
                  );
                }
              })
            }
          >
            {pending
              ? "처리 중…"
              : demo
                ? "기획 예시 보기"
                : "기획 초안 만들기"}
          </button>
          {plan && (
            <div className="plan-result">
              <h3>핵심 구매 이유</h3>
              <p>{plan.coreUsp}</p>
              <h3>기획 전략</h3>
              <p>{plan.strategy}</p>
              <h3>전성분 검토</h3>
              {plan.ingredientInsights.map((item, i) => (
                <p key={i}>
                  <strong>{item.ingredient}</strong> · {item.role}
                  <br />
                  <span className="small muted">{item.limitation}</span>
                </p>
              ))}
              {plan.sections.map((section, index) => (
                <article className="plan-section" key={index}>
                  <span className="eyebrow">구좌 {index + 1}</span>
                  <h3>{section.headline}</h3>
                  <p>{section.body}</p>
                  <p className="small muted">
                    비주얼 가이드 · {section.visualGuide}
                  </p>
                  <p className="small muted">
                    연결 근거 {section.evidenceIds.length}개
                  </p>
                </article>
              ))}
              <ul className="small muted">
                {plan.cautions.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <button
                type="button"
                className="button secondary"
                onClick={downloadPlan}
              >
                기획 초안 내려받기
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
