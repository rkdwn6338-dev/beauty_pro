import { describe, it, expect } from "vitest";
import {
  validateFile,
  fileSignatureMatches,
  MAX_FILE_BYTES,
  storagePath,
  belongsToProject,
} from "@/lib/files";
describe("원본 파일 검증", () => {
  it("20MiB 경계를 지키고 빈 파일과 실행 파일을 거절한다", () => {
    expect(
      validateFile({
        name: "시험.pdf",
        size: MAX_FILE_BYTES,
        type: "application/pdf",
      }),
    ).toBeNull();
    expect(
      validateFile({
        name: "시험.pdf",
        size: MAX_FILE_BYTES + 1,
        type: "application/pdf",
      }),
    ).toBeTruthy();
    expect(
      validateFile({ name: "빈.pdf", size: 0, type: "application/pdf" }),
    ).toBeTruthy();
    expect(
      validateFile({ name: "문서.html", size: 50, type: "text/html" }),
    ).toBeTruthy();
  });
  it("확장자·MIME 위조를 파일 시그니처로 확인한다", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7");
    expect(fileSignatureMatches(pdf, "application/pdf")).toBe(true);
    expect(
      fileSignatureMatches(
        new TextEncoder().encode("<script>"),
        "application/pdf",
      ),
    ).toBe(false);
    expect(
      fileSignatureMatches(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      fileSignatureMatches(new Uint8Array([255, 216, 255, 224]), "image/jpeg"),
    ).toBe(true);
    expect(
      fileSignatureMatches(
        new TextEncoder().encode("RIFF0000WEBP"),
        "image/webp",
      ),
    ).toBe(true);
    expect(fileSignatureMatches(new Uint8Array([]), "image/png")).toBe(false);
  });
  it("고객 파일명을 경로에 넣지 않고 프로젝트별로 분리한다", () => {
    const path = storagePath("project-a", "upload-id", "application/pdf");
    expect(path).toBe("project-a/upload-id.pdf");
    expect(belongsToProject(path, "project-a")).toBe(true);
    expect(belongsToProject(path, "project-b")).toBe(false);
    expect(belongsToProject("project-a/../secret", "project-a")).toBe(false);
    expect(belongsToProject("project-a-copy/a.pdf", "project-a")).toBe(false);
  });
});
