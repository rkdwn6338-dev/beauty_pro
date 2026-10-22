import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const fixture = vi.hoisted(() => ({
  user: { id: "10000000-0000-4000-8000-000000000001" } as { id: string } | null,
  project: true,
  file: null as Record<string, unknown> | null,
  storage: {
    download: vi.fn(),
    createSignedUrl: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
  },
  insert: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({ data: { user: fixture.user }, error: null }),
    },
    from: (table: string) => {
      const q = {
        select: vi.fn(() => q),
        eq: vi.fn(() => q),
        maybeSingle: async () => ({
          data:
            table === "projects"
              ? fixture.project
                ? { id: projectId }
                : null
              : fixture.file,
          error: null,
        }),
        insert: fixture.insert,
        update: fixture.update,
      };
      return q;
    },
    storage: { from: () => fixture.storage },
  }),
}));
import { POST } from "@/app/api/files/route";
const projectId = "20000000-0000-4000-8000-000000000001";
const fileId = "30000000-0000-4000-8000-000000000001";
const call = (body: object, origin = "https://app.example") =>
  POST(
    new NextRequest("https://app.example/api/files", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
beforeEach(() => {
  fixture.user = { id: "10000000-0000-4000-8000-000000000001" };
  fixture.project = true;
  fixture.file = {
    id: fileId,
    project_id: projectId,
    storage_path: `${projectId}/${fileId}.pdf`,
    status: "uploaded",
    filename: "보고서.pdf",
    uploaded_by: fixture.user.id,
    mime_type: "application/pdf",
    bytes: 8,
  };
  vi.clearAllMocks();
  delete process.env.ENABLE_SOURCE_DELETE;
});
describe("자료 API 권한 경계", () => {
  it("외부 출처 요청을 차단한다", async () => {
    expect(
      (
        await call(
          { operation: "download", projectId, fileId },
          "https://other.example",
        )
      ).status,
    ).toBe(403);
  });
  it("미로그인 접근을 차단한다", async () => {
    fixture.user = null;
    expect(
      (await call({ operation: "download", projectId, fileId })).status,
    ).toBe(401);
    expect(fixture.storage.createSignedUrl).not.toHaveBeenCalled();
  });
  it("다른 회사 프로젝트의 파일 접근을 차단한다", async () => {
    fixture.project = false;
    expect(
      (await call({ operation: "download", projectId, fileId })).status,
    ).toBe(404);
    expect(fixture.storage.createSignedUrl).not.toHaveBeenCalled();
  });
  it("파일 경로가 프로젝트와 다르면 차단한다", async () => {
    fixture.file!.storage_path = "other-project/secret.pdf";
    expect(
      (await call({ operation: "download", projectId, fileId })).status,
    ).toBe(404);
  });
  it("완료된 파일에만 60초 다운로드 주소를 발급한다", async () => {
    fixture.storage.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/signed" },
      error: null,
    });
    expect(
      (await call({ operation: "download", projectId, fileId })).status,
    ).toBe(200);
    expect(fixture.storage.createSignedUrl).toHaveBeenCalledWith(
      `${projectId}/${fileId}.pdf`,
      60,
      { download: "보고서.pdf" },
    );
    fixture.file!.status = "failed";
    expect(
      (await call({ operation: "download", projectId, fileId })).status,
    ).toBe(409);
  });
  it("다른 사용자의 미완료 업로드를 확정하지 못한다", async () => {
    fixture.file!.status = "processing";
    fixture.file!.uploaded_by = "other-user";
    expect(
      (await call({ operation: "complete", projectId, fileId })).status,
    ).toBe(409);
    expect(fixture.storage.download).not.toHaveBeenCalled();
  });
  it("기존 삭제 정책을 임의로 우회하지 않는다", async () => {
    expect(
      (await call({ operation: "delete", projectId, fileId })).status,
    ).toBe(403);
    expect(fixture.storage.remove).not.toHaveBeenCalled();
  });
  it("유효하지 않은 파일 크기를 등록 전에 차단한다", async () => {
    expect(
      (
        await call({
          operation: "prepare",
          projectId,
          productId: null,
          filename: "빈.pdf",
          size: 0,
          type: "application/pdf",
        })
      ).status,
    ).toBe(400);
    expect(fixture.insert).not.toHaveBeenCalled();
  });
});
