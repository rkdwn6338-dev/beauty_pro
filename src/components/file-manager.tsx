"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileText,
  ImageIcon,
  Download,
  Trash2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  BUCKET,
  fileSignatureMatches,
  formatBytes,
  validateFile,
} from "@/lib/files";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Tables } from "@/lib/database.types";
type FileReply = { id?: string; path?: string; url?: string; error?: string };
async function fileRequest(input: Record<string, unknown>): Promise<FileReply> {
  const response = await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "파일 작업을 완료하지 못했습니다.");
  return result;
}
export function FileManager({
  projectId,
  productId,
  files,
  deleteEnabled,
}: {
  projectId: string;
  productId: string | null;
  files: Tables<"source_files">[];
  deleteEnabled: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  function upload(filesToUpload: File[]) {
    if (pending) return;
    setError("");
    startTransition(async () => {
      const errors: string[] = [];
      let successes = 0;
      for (const [index, file] of filesToUpload.entries()) {
        let recordId: string | undefined;
        try {
          const invalid = validateFile(file);
          if (invalid) throw new Error(invalid);
          if (
            !fileSignatureMatches(
              new Uint8Array(await file.slice(0, 16).arrayBuffer()),
              file.type,
            )
          )
            throw new Error("파일 내용이 선택한 형식과 일치하지 않습니다.");
          setProgress(
            `${index + 1}/${filesToUpload.length} · ${file.name} 전송 중…`,
          );
          const prepared = await fileRequest({
            operation: "prepare",
            projectId,
            productId,
            filename: file.name,
            size: file.size,
            type: file.type,
          });
          recordId = prepared.id;
          const supabase = supabaseBrowser();
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(prepared.path!, file, {
              contentType: file.type,
              upsert: false,
              cacheControl: "0",
            });
          if (error)
            throw new Error(
              "파일을 전송하지 못했습니다. 로그인 상태와 연결을 확인해 주세요.",
            );
          setProgress(`${file.name} · 원본 확인 중…`);
          await fileRequest({
            operation: "complete",
            projectId,
            fileId: recordId,
          });
          successes++;
        } catch (e) {
          errors.push(
            `${file.name}: ${e instanceof Error ? e.message : "업로드에 실패했습니다."}`,
          );
          if (recordId)
            await fileRequest({
              operation: "failed",
              projectId,
              fileId: recordId,
            }).catch(() => {});
        }
      }
      setError(errors.join("\n"));
      setProgress(`${successes}개 파일 업로드 완료`);
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }
  function operate(operation: "download" | "delete", fileId: string) {
    setError("");
    startTransition(async () => {
      try {
        const result = await fileRequest({ operation, projectId, fileId });
        if (result.url) {
          const anchor = document.createElement("a");
          anchor.href = result.url;
          anchor.rel = "noopener";
          anchor.click();
        } else {
          setProgress("파일을 삭제했습니다.");
          setConfirmId(null);
          router.refresh();
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "요청을 완료하지 못했습니다.",
        );
      }
    });
  }
  return (
    <div className="files-layout">
      <div>
        <div
          className={`upload-zone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            upload(Array.from(e.dataTransfer.files));
          }}
        >
          <div className="upload-icon">
            <UploadCloud size={30} />
          </div>
          <h2>제품의 근거를 모아주세요.</h2>
          <p>임상 보고서, 성분표, 제품 사진을 끌어 놓거나 선택해 주세요.</p>
          <input
            ref={input}
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => upload(Array.from(e.target.files ?? []))}
            className="visually-hidden"
            aria-label="자료 파일 선택"
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="button primary"
            disabled={pending}
          >
            {pending ? (
              <>
                <LoaderCircle size={17} className="spin" />
                업로드 중…
              </>
            ) : (
              <>
                <UploadCloud size={17} />
                파일 선택
              </>
            )}
          </button>
          <p className="small muted">
            PDF · JPEG · PNG · WebP / 파일당 최대 20MiB
          </p>
        </div>
        <div aria-live="polite">
          {progress && <p className="notice">{progress}</p>}
          {error && (
            <p className="notice error preserve-lines" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="list-heading">
          <h2>
            업로드한 자료 <span className="count">{files.length}</span>
          </h2>
          <span className="small muted">파일명은 원본 그대로 기록됩니다.</span>
        </div>
        {files.length === 0 ? (
          <div className="empty-state panel">
            <FileText size={36} />
            <h3>아직 업로드한 자료가 없습니다.</h3>
            <p>제품의 특징을 뒷받침할 자료부터 올려보세요.</p>
          </div>
        ) : (
          <div className="file-list">
            {files.map((file) => (
              <article className="file-row" key={file.id}>
                <span className="file-icon">
                  {file.mime_type === "application/pdf" ? (
                    <FileText size={23} />
                  ) : (
                    <ImageIcon size={23} />
                  )}
                </span>
                <div className="file-info">
                  <strong>{file.filename}</strong>
                  <p>
                    {formatBytes(file.bytes ?? 0)} <span>·</span>{" "}
                    {new Date(file.created_at).toLocaleDateString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </p>
                </div>
                <span
                  className={`badge ${file.status === "failed" ? "danger" : ""}`}
                >
                  {(
                    {
                      uploaded: "업로드 완료",
                      processing: "전송 확인 필요",
                      failed: "업로드 실패",
                      analyzed: "분석 완료",
                    } as Record<string, string>
                  )[file.status] ?? file.status}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${file.filename} 다운로드`}
                  disabled={
                    pending || !["uploaded", "analyzed"].includes(file.status)
                  }
                  onClick={() => operate("download", file.id)}
                >
                  <Download size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${file.filename} 삭제`}
                  title={deleteEnabled ? "파일 삭제" : "삭제 권한 설정 대기"}
                  disabled={pending || !deleteEnabled}
                  onClick={() => setConfirmId(file.id)}
                >
                  <Trash2 size={18} />
                </button>
                {confirmId === file.id && (
                  <div className="delete-confirm">
                    <p>
                      이 원본 파일을 영구 삭제할까요? 삭제한 파일은 복원할 수
                      없습니다.
                    </p>
                    <button
                      className="button danger"
                      disabled={pending}
                      onClick={() => operate("delete", file.id)}
                      type="button"
                    >
                      영구 삭제
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setConfirmId(null)}
                      type="button"
                    >
                      취소
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
      <aside className="panel file-guide">
        <ShieldCheck size={27} />
        <h3>
          회사 안에서만,
          <br />
          안전하게.
        </h3>
        <p className="small muted">
          업로드한 자료는 같은 회사에 소속된 사용자만 볼 수 있습니다. 다운로드
          주소는 1분 후 만료됩니다.
        </p>
        <hr />
        <h4>다음 단계 안내</h4>
        <p className="small muted">
          문서 자동 분석은 준비 중입니다. 현재는 원본 업로드·조회·다운로드를
          사용할 수 있습니다.
        </p>
        {!deleteEnabled && (
          <p className="small muted">
            삭제 기능은 기존 저장소의 권한 설정을 검토한 뒤 제공됩니다.
          </p>
        )}
      </aside>
    </div>
  );
}
