"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { PlanEditor } from "./plan-editor";
import {
  planDocumentSchema,
  sameValue,
  type PlanDocument,
  type PlanVersion,
} from "@/lib/plan-document";
import { exportPlanHtml } from "@/lib/plan-export";
type History = Pick<
  PlanVersion,
  "id" | "revision" | "action" | "created_at" | "created_by" | "restored_from"
>;
const actionLabels = {
  create: "기획 시작",
  generate: "새 기획",
  edit: "편집",
  approve: "구좌 승인",
  unapprove: "승인 해제",
  restore: "이전 버전 복구",
  regenerate_section: "구좌 재생성",
};
function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PlanningWorkspace({
  projectId,
  productId,
  storageReady,
  aiReady,
}: {
  projectId: string;
  productId: string | null;
  storageReady: boolean;
  aiReady: boolean;
}) {
  const [version, setVersion] = useState<PlanVersion | null>(null);
  const [draft, setDraft] = useState<PlanDocument | null>(null);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [busy, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(!storageReady || !productId);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pendingGeneration = useRef<Record<string, unknown> | null>(null);
  const [hasPendingGeneration, setHasPendingGeneration] = useState(false);
  const [consent, setConsent] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [historyBefore, setHistoryBefore] = useState<number | null>(null);
  const dirty = !!draft && !!version && !sameValue(draft, version.snapshot);
  const historical = !!version && version.id !== latestId;
  async function call(body: Record<string, unknown>, signal?: AbortSignal) {
    const response = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, productId, ...body }),
      signal,
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error ?? "기획서 요청을 완료하지 못했습니다.");
    return data;
  }
  function accept(next: PlanVersion) {
    const snapshot = planDocumentSchema.parse(next.snapshot);
    setVersion({ ...next, snapshot });
    setDraft(structuredClone(snapshot));
  }
  useEffect(() => {
    if (!storageReady || !productId) return;
    const controller = new AbortController();
    // 마운트할 때만 저장된 최신 버전을 읽습니다. 실패 시 사용자가 재시도할 수 있습니다.
    fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "read", projectId, productId }),
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "기획서를 불러오지 못했습니다.");
        return d;
      })
      .then((data) => {
        if (data.version) accept(data.version);
        setLatestId(data.latestId);
        setHistory(data.history);
        setHasMore(data.history.length === 20);
        setHistoryBefore(data.history.at(-1)?.revision ?? null);
        setLoaded(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error ? e.message : "기획서를 불러오지 못했습니다.",
          );
          setLoaded(true);
        }
      });
    return () => controller.abort();
  }, [projectId, productId, storageReady]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const navigate = (e: MouseEvent) => {
      const target =
        e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (
        target &&
        !target.hasAttribute("download") &&
        !window.confirm(
          "저장하지 않은 수정 내용이 있습니다. 저장하지 않고 이동할까요?",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
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
  async function read(versionId?: string) {
    const data = await call({ operation: "read", versionId });
    if (data.version) accept(data.version);
    setLatestId(data.latestId);
    setHistory((rows) => {
      const merged = new Map<string, History>(
        [...rows, ...data.history, ...(data.version ? [data.version] : [])].map(
          (h) => [
            h.id,
            {
              id: h.id,
              revision: h.revision,
              action: h.action,
              created_at: h.created_at,
              created_by: h.created_by,
              restored_from: h.restored_from,
            },
          ],
        ),
      );
      return [...merged.values()].sort((a, b) => b.revision - a.revision);
    });
    setHasMore(data.history.length === 20);
    setHistoryBefore(data.history.at(-1)?.revision ?? null);
  }
  async function save(operation: string, extra: Record<string, unknown> = {}) {
    const body: Record<string, unknown> = {
      operation,
      baseId: latestId,
      ...extra,
    };
    const generation =
      operation === "generate" || operation === "regenerate_section";
    if (generation) {
      if (pendingGeneration.current)
        throw new Error("이전 AI 요청 상태를 먼저 확인해 주세요.");
      body.requestId = crypto.randomUUID();
      pendingGeneration.current = body;
      setHasPendingGeneration(true);
    }
    const data = await call(body);
    applySaved(data.version);
    if (data.replayed) await read(data.version.id);
    if (generation) {
      pendingGeneration.current = null;
      setHasPendingGeneration(false);
    }
  }
  function applySaved(next: PlanVersion) {
    const data = { version: next };
    accept(data.version);
    setLatestId(data.version.id);
    setHistory((rows) => [
      {
        id: data.version.id,
        revision: data.version.revision,
        action: data.version.action,
        created_at: data.version.created_at,
        created_by: data.version.created_by,
        restored_from: data.version.restored_from,
      },
      ...rows.filter((row) => row.id !== data.version.id),
    ]);
    setMessage(
      `버전 ${data.version.revision}으로 저장했습니다. 이전 버전은 그대로 보관됩니다.`,
    );
  }
  return (
    <div className="analysis-layout">
      <section className="panel">
        <span className="eyebrow">브리프에서 제작 기획서로</span>
        <h2>한 구좌씩 다듬고, 버전으로 보관하세요.</h2>
        <p className="small muted">
          수정·승인·복구는 각각 새 버전으로 저장됩니다. 승인한 구좌는 승인을
          해제한 뒤 수정할 수 있습니다.
        </p>
        {!productId ? (
          <p className="notice">제품 브리프를 먼저 저장해 주세요.</p>
        ) : !storageReady ? (
          <p className="notice">
            기획서 편집 기능을 준비했습니다. 버전 저장용 테이블과 보호 장치를
            확인한 뒤 연결할 예정입니다.
          </p>
        ) : (
          <>
            <div className="planning-toolbar">
              <button
                className="button secondary"
                disabled={busy || dirty || !loaded || historical}
                onClick={() => {
                  if (
                    !version ||
                    window.confirm(
                      "현재 기획은 이전 버전으로 보관하고, 최신 브리프로 새 직접 기획을 시작할까요? 새 기획의 구좌는 승인 전 상태입니다.",
                    )
                  )
                    act(() => save("manual"));
                }}
              >
                직접 기획 시작
              </button>
              <button
                className="button primary"
                disabled={
                  busy ||
                  dirty ||
                  !loaded ||
                  !aiReady ||
                  !consent ||
                  historical ||
                  hasPendingGeneration
                }
                onClick={() => {
                  if (
                    !version ||
                    window.confirm(
                      "전체 기획을 새로 생성할까요? 새 구좌는 승인 전 상태이며 이전 기획은 버전으로 보관됩니다.",
                    )
                  )
                    act(() => save("generate", { consent: true }));
                }}
              >
                AI로 새 기획 만들기
              </button>
              <button
                className="button secondary"
                disabled={busy || dirty}
                onClick={() => act(() => read())}
              >
                최신 버전 불러오기
              </button>
            </div>
            {aiReady ? (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                제품 브리프와 승인된 근거를 AI 제공자에게 전송하고 사용량에 따른
                비용이 발생할 수 있음에 동의합니다.
              </label>
            ) : (
              <p className="small muted">
                AI 생성은 모델과 사용 예산 설정 후 활성화됩니다. 직접 기획은 AI
                호출 없이 사용할 수 있습니다.
              </p>
            )}
          </>
        )}
      </section>
      <div aria-live="polite">
        {!loaded && <p className="notice">기획서를 불러오는 중입니다.</p>}
        {busy && (
          <p className="notice">
            처리 중입니다. 이 화면에서 잠시 기다려 주세요.
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {message && <p className="notice">{message}</p>}
      </div>
      {hasPendingGeneration && (
        <section className="panel" aria-label="AI 요청 확인">
          <h3>이전 AI 요청 상태를 확인해 주세요.</h3>
          <p className="small muted">
            응답을 받지 못했어도 생성 결과가 저장됐을 수 있습니다. 상태 확인은
            AI를 새로 호출하지 않습니다.
          </p>
          <div className="planning-toolbar">
            <button
              className="button secondary"
              disabled={busy || dirty}
              onClick={() =>
                act(async () => {
                  if (!pendingGeneration.current) return;
                  const data = await call({
                    ...pendingGeneration.current,
                    checkOnly: true,
                  });
                  applySaved(data.version);
                  await read(data.version.id);
                  pendingGeneration.current = null;
                  setHasPendingGeneration(false);
                })
              }
            >
              이전 요청 상태 확인
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "최신 버전과 이전 요청 결과를 먼저 확인했나요? 새로 생성하면 AI 사용량이 추가될 수 있습니다. 새 요청을 준비할까요?",
                  )
                ) {
                  pendingGeneration.current = null;
                  setHasPendingGeneration(false);
                  setMessage(
                    "새 AI 요청을 준비했습니다. 진행 중인 요청이 있으면 서버에서 추가 호출을 막습니다.",
                  );
                }
              }}
            >
              새 AI 요청 준비
            </button>
          </div>
        </section>
      )}
      {version && draft && (
        <>
          <section className="panel planning-version-bar">
            <label>
              저장된 버전
              <select
                aria-label="저장된 버전"
                disabled={busy || dirty}
                value={version.id}
                onChange={(e) => act(() => read(e.target.value))}
              >
                {history.map((h) => (
                  <option value={h.id} key={h.id}>
                    버전 {h.revision} · {actionLabels[h.action]} ·{" "}
                    {new Date(h.created_at).toLocaleString("ko-KR")}
                  </option>
                ))}
              </select>
            </label>
            {hasMore && (
              <button
                className="button secondary small-button"
                disabled={busy || dirty}
                onClick={() =>
                  act(async () => {
                    const data = await call({
                      operation: "history",
                      beforeRevision: historyBefore,
                    });
                    setHistory((rows) => [
                      ...rows,
                      ...data.history.filter(
                        (h: History) => !rows.some((r) => r.id === h.id),
                      ),
                    ]);
                    setHasMore(data.history.length === 20);
                    setHistoryBefore(data.history.at(-1)?.revision ?? null);
                  })
                }
              >
                이전 버전 더 보기
              </button>
            )}
            {historical ? (
              <>
                <p className="notice">
                  이전 버전을 보고 있습니다. 복구하면 이 내용을 복사한 새 버전이
                  만들어집니다.
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `버전 ${version.revision}의 내용과 승인 상태를 복구할까요? 현재 버전도 이력에 남습니다.`,
                      )
                    )
                      act(() => save("restore", { versionId: version.id }));
                  }}
                >
                  이 버전으로 복구
                </button>
              </>
            ) : (
              <div className="planning-toolbar">
                <button
                  className="button primary"
                  disabled={busy || !dirty}
                  onClick={() => act(() => save("edit", { snapshot: draft }))}
                >
                  변경 내용 저장
                </button>
                <button
                  className="button secondary"
                  disabled={busy || !dirty}
                  onClick={() => {
                    if (window.confirm("저장하지 않은 변경 내용을 취소할까요?"))
                      setDraft(structuredClone(version.snapshot));
                  }}
                >
                  변경 취소
                </button>
              </div>
            )}
            {dirty && (
              <p className="small muted">
                저장하지 않은 변경이 있습니다. 승인·버전 이동·제작용 내보내기는
                저장 후 사용할 수 있습니다.
              </p>
            )}
            <div className="planning-toolbar">
              <button
                className="button secondary small-button"
                disabled={busy || dirty}
                onClick={() =>
                  download(
                    exportPlanHtml(version),
                    "text/html;charset=utf-8",
                    `상세페이지_기획서_v${version.revision}.html`,
                  )
                }
              >
                제작용 기획서 내려받기
              </button>
              <button
                className="button secondary small-button"
                disabled={busy}
                onClick={() =>
                  download(
                    JSON.stringify(
                      dirty
                        ? {
                            savedVersionId: version.id,
                            unsaved: true,
                            snapshot: draft,
                          }
                        : version,
                      null,
                      2,
                    ),
                    "application/json",
                    dirty
                      ? "미저장_기획_백업.json"
                      : `기획_v${version.revision}.json`,
                  )
                }
              >
                {dirty ? "미저장 내용 백업" : "기획 원본 내려받기"}
              </button>
            </div>
            <p className="small muted">
              제작용 기획서는 브라우저에서 열어 인쇄하거나 PDF로 저장할 수
              있습니다. 승인 전 내용은 검토용으로 표시됩니다.
            </p>
          </section>
          <PlanEditor
            version={version}
            draft={draft}
            onChange={setDraft}
            busy={busy}
            locked={historical}
            dirty={dirty}
            canRegenerate={aiReady && consent && !hasPendingGeneration}
            onRegenerate={(sectionId, instruction) =>
              act(() =>
                save("regenerate_section", {
                  sectionId,
                  instruction,
                  consent: true,
                }),
              )
            }
            onApproval={(sectionId, approve) =>
              act(() => save(approve ? "approve" : "unapprove", { sectionId }))
            }
          />
        </>
      )}
    </div>
  );
}
