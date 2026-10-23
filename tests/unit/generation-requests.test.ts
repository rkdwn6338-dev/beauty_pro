import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  boundedPlanningInput,
  completeGeneration,
  failGeneration,
  findGeneration,
  generationHash,
  reserveGeneration,
  type GenerationIntent,
} from "@/lib/generation-requests";
const intent: GenerationIntent = {
  requestId: crypto.randomUUID(),
  agencyId: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  productId: crypto.randomUUID(),
  userId: crypto.randomUUID(),
  operation: "generate",
  baseId: null,
};
let row: Record<string, unknown> | null;
let readError: boolean;
let writeError: string | null;
let insertError: string | null;
let rpcError: boolean;
let operations: {
  table: string;
  kind: string;
  payload?: unknown;
  filters: unknown[][];
}[];
function fakeClient() {
  return {
    from: (table: string) => {
      const record = {
        table,
        kind: "read",
        payload: undefined as unknown,
        filters: [] as unknown[][],
      };
      operations.push(record);
      const result = () => ({
        data: table === "planning_versions" ? { id: "saved-version" } : row,
        error:
          record.kind === "read"
            ? readError
              ? { code: "network" }
              : null
            : record.kind === "insert" && insertError
              ? { code: insertError }
              : writeError
                ? { code: writeError }
                : null,
      });
      const q = {
        select: () => q,
        eq: (...args: unknown[]) => {
          record.filters.push(args);
          return q;
        },
        lt: (...args: unknown[]) => {
          record.filters.push(args);
          return q;
        },
        insert: (payload: unknown) => {
          record.kind = "insert";
          record.payload = payload;
          return q;
        },
        update: (payload: unknown) => {
          record.kind = "update";
          record.payload = payload;
          return q;
        },
        maybeSingle: async () => result(),
        then: (resolve: (r: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(resolve(result())),
      };
      return q;
    },
    rpc: () => ({
      single: async () => ({
        data: rpcError ? null : { id: "saved-version" },
        error: rpcError ? { code: "network" } : null,
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}
beforeEach(() => {
  vi.stubEnv("ENABLE_GENERATION_GUARD", "true");
  row = null;
  readError = false;
  writeError = null;
  insertError = null;
  rpcError = false;
  operations = [];
});
describe("기획 AI 중복 요청 처리", () => {
  it("보호 저장소 비활성 상태에는 요청 기록도 호출도 하지 않는다", async () => {
    vi.stubEnv("ENABLE_GENERATION_GUARD", "false");
    await expect(findGeneration(fakeClient(), intent)).rejects.toMatchObject({
      status: 503,
    });
    expect(operations).toHaveLength(0);
  });
  it("새 번호가 아닌 요청 내용과 사용자 범위로 의도를 비교한다", () => {
    expect(generationHash(intent)).toBe(
      generationHash({ ...intent, requestId: crypto.randomUUID() }),
    );
    expect(generationHash(intent)).not.toBe(
      generationHash({ ...intent, userId: crypto.randomUUID() }),
    );
    expect(generationHash(intent)).not.toBe(
      generationHash({ ...intent, instruction: "다르게" }),
    );
  });
  it("첫 요청은 빈 기록으로 처리하고 회사·제품·요청자 범위를 확인한다", async () => {
    expect(await findGeneration(fakeClient(), intent)).toBeNull();
    expect(operations[0].filters).toContainEqual([
      "requested_by",
      intent.userId,
    ]);
    expect(operations[0].filters).toContainEqual([
      "project_id",
      intent.projectId,
    ]);
  });
  it("다른 입력으로 동일 번호를 재사용하지 않는다", async () => {
    row = {
      input_hash: "다른 해시",
      status: "completed",
      result_version_id: crypto.randomUUID(),
    };
    await expect(findGeneration(fakeClient(), intent)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("완료 결과를 다시 읽을 때 공급자 재호출용 예약을 추가하지 않는다", async () => {
    row = {
      input_hash: generationHash(intent),
      status: "completed",
      result_version_id: crypto.randomUUID(),
    };
    expect(await findGeneration(fakeClient(), intent)).toEqual({
      id: "saved-version",
    });
    expect(operations.some((o) => o.kind !== "read")).toBe(false);
  });
  it("진행·실패·만료된 같은 요청으로 새 예약을 만들지 않는다", async () => {
    for (const status of ["running", "failed", "expired"]) {
      row = { input_hash: generationHash(intent), status };
      await expect(findGeneration(fakeClient(), intent)).rejects.toMatchObject({
        status: 409,
      });
    }
    expect(operations.some((o) => o.kind !== "read")).toBe(false);
  });
  it("조회나 만료 정리 실패를 성공으로 간주하지 않는다", async () => {
    readError = true;
    await expect(findGeneration(fakeClient(), intent)).rejects.toMatchObject({
      status: 503,
    });
    readError = false;
    writeError = "23505";
    await expect(
      reserveGeneration(fakeClient(), intent, "test/model"),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("중복 예약과 일일 한도 초과를 차단한다", async () => {
    for (const code of ["23505", "P0001"]) {
      insertError = code;
      await expect(
        reserveGeneration(fakeClient(), intent, "test/model"),
      ).rejects.toMatchObject({ status: 409 });
    }
  });
  it("예약에는 클라이언트 요청 번호와 서버 해시를 기록한다", async () => {
    await reserveGeneration(fakeClient(), intent, "test/model");
    expect(operations.find((o) => o.kind === "insert")?.payload).toMatchObject({
      id: intent.requestId,
      input_hash: generationHash(intent),
      requested_by: intent.userId,
      status: "running",
      model: "test/model",
    });
  });
  it("원자적 완료 응답이 유실되면 새 호출로 재시도하지 않는다", async () => {
    rpcError = true;
    await expect(
      completeGeneration(fakeClient(), intent, {}),
    ).rejects.toMatchObject({ status: 503 });
    expect(operations).toHaveLength(0);
  });
  it("실패 기록도 실패하면 running 예약을 남긴다", async () => {
    writeError = "network";
    expect(await failGeneration(fakeClient(), intent)).toBe(false);
    expect(operations[0].payload).toMatchObject({ status: "failed" });
    expect(operations[0].filters).toContainEqual(["status", "running"]);
  });
  it("한글 입력량은 글자 수 대신 UTF-8 바이트로 제한한다", () => {
    expect(boundedPlanningInput({ text: "가".repeat(1000) })).toContain("가");
    expect(() => boundedPlanningInput({ text: "가".repeat(23000) })).toThrow(
      "입력량 한도",
    );
  });
});
