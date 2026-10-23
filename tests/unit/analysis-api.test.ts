import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { demoEvidence, demoFinding, demoPlan } from "@/lib/analysis-demo";
const projectId = "b1000000-0000-4000-8000-000000000001";
const fileId = "b2000000-0000-4000-8000-000000000001";
const productId = "b3000000-0000-4000-8000-000000000001";
const state = vi.hoisted(() => ({
  authenticated: true,
  projectVisible: true,
  fileVisible: true,
  ai: true,
  write: true,
  reviewStatus: "pending",
  evidenceRows: [] as Record<string, unknown>[],
  jobFailure: false,
  queries: [] as {
    table: string;
    operation: string;
    filters: unknown[][];
    payload?: unknown;
  }[],
  analyze: vi.fn(),
  generate: vi.fn(),
  model: vi.fn(),
}));
vi.mock("@/lib/ai", () => ({
  aiEnabled: () => state.ai,
  evidenceWriteEnabled: () => state.write,
  configuredModel: state.model,
  analyzeDocument: state.analyze,
  generatePlan: state.generate,
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: state.authenticated
            ? { id: "b4000000-0000-4000-8000-000000000001" }
            : null,
        },
        error: null,
      }),
    },
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob(["%PDF-1.4"]), error: null }),
      }),
    },
    from: (table: string) => {
      const record = {
        table,
        operation: "read",
        filters: [] as unknown[][],
        payload: undefined as unknown,
      };
      state.queries.push(record);
      const result = (single = false) => {
        let data: unknown = [];
        if (table === "projects")
          data = state.projectVisible ? { id: projectId, brand: "검사" } : null;
        if (table === "products")
          data = {
            id: productId,
            category: "페이스 클렌징",
            subtype: "폼",
            ingredients: "정제수, 글리세린",
          };
        if (table === "source_files")
          data = state.fileVisible
            ? single
              ? {
                  id: fileId,
                  project_id: projectId,
                  product_id: productId,
                  storage_path: projectId + "/file.pdf",
                  bytes: 8,
                  mime_type: "application/pdf",
                  status: "uploaded",
                }
              : [{ id: fileId, product_id: productId }]
            : null;
        if (table === "evidence")
          data = single
            ? {
                ...demoEvidence,
                source_file_id: fileId,
                extracted_result: {
                  ...(demoEvidence.extracted_result as object),
                  analysisJobId: "기존 분석 연결",
                },
                review_status: state.reviewStatus,
              }
            : state.evidenceRows;
        if (table === "analysis_jobs")
          data = single ? { id: "b5000000-0000-4000-8000-000000000001" } : [];
        return {
          data,
          error:
            table === "analysis_jobs" &&
            record.operation === "insert" &&
            state.jobFailure
              ? { message: "저장 불가" }
              : null,
        };
      };
      const query = {
        select: () => query,
        eq: (...args: unknown[]) => {
          record.filters.push(args);
          return query;
        },
        in: (...args: unknown[]) => {
          record.filters.push(args);
          return query;
        },
        lt: (...args: unknown[]) => {
          record.filters.push(args);
          return query;
        },
        insert: (payload: unknown) => {
          record.operation = "insert";
          record.payload = payload;
          return query;
        },
        update: (payload: unknown) => {
          record.operation = "update";
          record.payload = payload;
          return query;
        },
        single: async () => result(true),
        maybeSingle: async () => result(true),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(resolve(result())),
      };
      return query;
    },
  }),
}));
import { POST as analysis } from "@/app/api/analysis/route";
import { POST as planning } from "@/app/api/planning/route";
const request = (body: object, origin = "https://app.example") =>
  new NextRequest("https://app.example/api/analysis", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const analyzeInput = { operation: "analyze", projectId, fileId, consent: true };
const reviewInput = {
  operation: "review",
  projectId,
  evidenceId: demoEvidence.id,
  finding: demoFinding,
  decision: "approved",
  sourceChecked: true,
};
beforeEach(() => {
  state.authenticated = true;
  state.projectVisible = true;
  state.fileVisible = true;
  state.ai = true;
  state.write = true;
  state.reviewStatus = "pending";
  state.evidenceRows = [];
  state.jobFailure = false;
  state.queries = [];
  vi.clearAllMocks();
  state.model.mockResolvedValue("test/mock-model");
  state.generate.mockResolvedValue(demoPlan);
  state.analyze.mockResolvedValue({
    analysis: {
      documentType: "검사",
      summary: "검사",
      findings: [demoFinding],
      warnings: [],
    },
    usage: { inputTokens: 0, outputTokens: 0 },
  });
});
describe("분석 API 접근과 과금 경계", () => {
  it("외부 출처와 비로그인 요청은 AI를 호출하지 않는다", async () => {
    expect(
      (await analysis(request(analyzeInput, "https://other.example"))).status,
    ).toBe(403);
    state.authenticated = false;
    expect((await analysis(request(analyzeInput))).status).toBe(401);
    expect(state.analyze).not.toHaveBeenCalled();
  });
  it("다른 회사 프로젝트와 파일을 차단한다", async () => {
    state.projectVisible = false;
    expect((await analysis(request(analyzeInput))).status).toBe(404);
    state.projectVisible = true;
    state.fileVisible = false;
    expect((await analysis(request(analyzeInput))).status).toBe(404);
    expect(state.analyze).not.toHaveBeenCalled();
  });
  it("활성화하지 않은 AI와 저장 연결은 호출·쓰기를 막는다", async () => {
    state.ai = false;
    expect((await analysis(request(analyzeInput))).status).toBe(503);
    state.ai = true;
    state.write = false;
    expect((await analysis(request(analyzeInput))).status).toBe(503);
    expect(state.analyze).not.toHaveBeenCalled();
    expect(state.queries.some((q) => q.operation !== "read")).toBe(false);
  });
  it("중복 작업 등록에 실패하면 유료 생성을 시작하지 않는다", async () => {
    state.jobFailure = true;
    expect((await analysis(request(analyzeInput))).status).toBe(409);
    expect(state.analyze).not.toHaveBeenCalled();
  });
  it("추출 근거는 자동 승인하지 않고 검토 대기로 저장한다", async () => {
    expect((await analysis(request(analyzeInput))).status).toBe(200);
    const insert = state.queries.find(
      (q) => q.table === "evidence" && q.operation === "insert",
    );
    expect(insert?.payload).toEqual([
      expect.objectContaining({
        source_file_id: fileId,
        review_status: "pending",
        reviewed_by: null,
      }),
    ]);
  });
  it("원본 대조와 수치 검증 없이 승인하지 않는다", async () => {
    expect(
      (await analysis(request({ ...reviewInput, sourceChecked: false })))
        .status,
    ).toBe(422);
    expect(
      (
        await analysis(
          request({
            ...reviewInput,
            finding: { ...demoFinding, pageNumber: null },
          }),
        )
      ).status,
    ).toBe(422);
    expect(state.queries.some((q) => q.operation === "update")).toBe(false);
  });
  it("검토 저장 시 기존 분석 연결을 보존하고 실제 검토자를 기록한다", async () => {
    expect((await analysis(request(reviewInput))).status).toBe(200);
    expect(
      state.queries.find(
        (q) => q.table === "evidence" && q.operation === "update",
      )?.payload,
    ).toEqual(
      expect.objectContaining({
        reviewed_by: "b4000000-0000-4000-8000-000000000001",
        review_status: "approved",
        extracted_result: expect.objectContaining({
          analysisJobId: "기존 분석 연결",
        }),
      }),
    );
  });
  it("이미 승인한 근거를 덮어쓰지 않는다", async () => {
    state.reviewStatus = "approved";
    expect((await analysis(request(reviewInput))).status).toBe(409);
    expect(state.queries.some((q) => q.operation === "update")).toBe(false);
  });
  it("이전 임시 기획 API로 요청 보호를 우회하지 못한다", async () => {
    expect(
      (await planning(request({ projectId, productId, consent: true }))).status,
    ).toBe(410);
    expect(state.generate).not.toHaveBeenCalled();
    expect(state.queries.some((q) => q.table === "evidence")).toBe(false);
  });
});
