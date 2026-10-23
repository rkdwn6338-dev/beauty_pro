import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { demoPlan } from "@/lib/analysis-demo";
import {
  changeApproval,
  createDocument,
  type PlanVersion,
} from "@/lib/plan-document";
const ids = {
  project: "b1000000-0000-4000-8000-000000000001",
  product: "b2000000-0000-4000-8000-000000000001",
  user: "b3000000-0000-4000-8000-000000000001",
};
const state = vi.hoisted(() => ({
  find: vi.fn(),
  reserve: vi.fn(),
  finish: vi.fn(),
  fail: vi.fn(),
  ai: false,
  regenerate: vi.fn(),
  auth: true,
  visible: true,
  versions: [] as PlanVersion[],
  inserts: [] as Record<string, unknown>[],
  conflict: false,
  generate: vi.fn(),
}));
vi.mock("@/lib/generation-requests", async (original) => ({
  ...(await original<typeof import("@/lib/generation-requests")>()),
  findGeneration: state.find,
  reserveGeneration: state.reserve,
  completeGeneration: state.finish,
  failGeneration: state.fail,
}));
vi.mock("@/lib/ai", () => ({
  aiEnabled: () => state.ai,
  configuredModel: vi.fn().mockResolvedValue("test/mock-model"),
  generatePlan: state.generate,
  regenerateSection: state.regenerate,
}));
vi.mock("@/lib/planning-context", () => ({
  planningContext: async () => ({
    basis: {
      productId: ids.product,
      brand: "검사",
      name: "폼",
      category: "페이스 클렌징",
      subtype: "폼",
      ingredients: "정제수, 글리세린",
    },
    product: {},
    sources: [],
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.auth ? { id: ids.user } : null },
        error: null,
      }),
    },
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let payload: Record<string, unknown> | null = null;
      let limit = 100;
      const result = (single = false) => {
        let data: unknown = null;
        let error: { code: string } | null = null;
        if (table === "projects")
          data = state.visible ? { id: ids.project, brand: "검사" } : null;
        if (table === "products")
          data = state.visible ? { id: ids.product } : null;
        if (table === "planning_versions") {
          if (payload) {
            state.inserts.push(payload);
            if (state.conflict) error = { code: "23505" };
            else {
              data = {
                ...payload,
                id: crypto.randomUUID(),
                created_at: new Date().toISOString(),
              };
              state.versions.push(data as PlanVersion);
            }
          } else {
            const rows = state.versions
              .filter((v) =>
                Object.entries(filters).every(
                  ([k, val]) =>
                    (v as unknown as Record<string, unknown>)[k] === val,
                ),
              )
              .sort((a, b) => b.revision - a.revision)
              .slice(0, limit);
            data = single ? (rows[0] ?? null) : rows;
          }
        }
        return { data, error };
      };
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return q;
        },
        order: () => q,
        limit: (n: number) => {
          limit = n;
          return q;
        },
        lt: () => q,
        insert: (p: Record<string, unknown>) => {
          payload = p;
          return q;
        },
        maybeSingle: async () => result(true),
        single: async () => result(true),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(resolve(result())),
      };
      return q;
    },
  }),
}));
import { POST } from "@/app/api/plans/route";
const req = (body: Record<string, unknown>, origin = "https://app.example") =>
  new NextRequest("https://app.example/api/plans", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: "b9000000-0000-4000-8000-000000000001",
      projectId: ids.project,
      productId: ids.product,
      ...body,
    }),
  });
const seed = (): PlanVersion => ({
  id: crypto.randomUUID(),
  project_id: ids.project,
  product_id: ids.product,
  revision: 1,
  parent_id: null,
  restored_from: null,
  changed_section_id: null,
  action: "create",
  created_by: ids.user,
  created_at: new Date().toISOString(),
  snapshot: createDocument(
    {
      ...demoPlan,
      sections: demoPlan.sections.filter((s) => s.type !== "clinical"),
    },
    {
      productId: ids.product,
      brand: "검사",
      name: "폼",
      category: "페이스 클렌징",
      subtype: "폼",
      ingredients: "정제수, 글리세린",
    },
    [],
  ),
});
beforeEach(() => {
  state.ai = false;
  state.auth = true;
  state.visible = true;
  state.versions = [];
  state.inserts = [];
  state.conflict = false;
  vi.stubEnv("ENABLE_PLAN_STORAGE", "true");
  vi.clearAllMocks();
  state.find.mockResolvedValue(null);
  state.reserve.mockResolvedValue(undefined);
  state.fail.mockResolvedValue(true);
  state.finish.mockImplementation(async (_client, intent, snapshot) => {
    const previous = state.versions.at(-1);
    const version = {
      ...seed(),
      id: crypto.randomUUID(),
      revision: (previous?.revision ?? 0) + 1,
      parent_id: previous?.id ?? null,
      snapshot,
      action:
        intent.operation === "regenerate_section"
          ? "regenerate_section"
          : previous
            ? "generate"
            : "create",
      changed_section_id: intent.sectionId ?? null,
    } as PlanVersion;
    state.versions.push(version);
    return version;
  });
});
describe("기획 버전 API", () => {
  it("예약하지 못하면 AI를 호출하지 않는다", async () => {
    const v = seed();
    state.versions = [v];
    state.ai = true;
    state.reserve.mockRejectedValue(new Error("예약 실패"));
    expect(
      (
        await POST(
          req({
            operation: "regenerate_section",
            baseId: v.id,
            sectionId: v.snapshot.sections[1].id,
            consent: true,
          }),
        )
      ).status,
    ).toBe(502);
    expect(state.regenerate).not.toHaveBeenCalled();
    expect(state.finish).not.toHaveBeenCalled();
  });
  it("상태 확인 요청은 기록이 없어도 AI를 새로 시작하지 않는다", async () => {
    const v = seed();
    state.versions = [v];
    state.ai = true;
    expect(
      (
        await POST(
          req({
            operation: "regenerate_section",
            baseId: v.id,
            sectionId: v.snapshot.sections[1].id,
            checkOnly: true,
          }),
        )
      ).status,
    ).toBe(404);
    expect(state.reserve).not.toHaveBeenCalled();
    expect(state.regenerate).not.toHaveBeenCalled();
  });
  it("완료 요청 재확인은 이전 기준 버전이어도 같은 결과를 반환한다", async () => {
    const v = seed();
    state.versions = [v, { ...v, id: crypto.randomUUID(), revision: 2 }];
    state.find.mockResolvedValue(v);
    const response = await POST(
      req({ operation: "generate", baseId: null, checkOnly: true }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).replayed).toBe(true);
    expect(state.reserve).not.toHaveBeenCalled();
    expect(state.generate).not.toHaveBeenCalled();
  });
  it("완료 응답 유실 시 예약을 실패로 바꾸어 새 호출을 허용하지 않는다", async () => {
    const v = seed();
    state.versions = [v];
    state.ai = true;
    state.regenerate.mockResolvedValue({
      ...v.snapshot.sections[1],
      headline: "변경",
    });
    state.finish.mockRejectedValue(new Error("저장 응답 유실"));
    expect(
      (
        await POST(
          req({
            operation: "regenerate_section",
            baseId: v.id,
            sectionId: v.snapshot.sections[1].id,
            consent: true,
          }),
        )
      ).status,
    ).toBe(503);
    expect(state.regenerate).toHaveBeenCalledTimes(1);
    expect(state.fail).not.toHaveBeenCalled();
  });
  it("입력량 초과는 예약과 유료 호출 전에 거절한다", async () => {
    const v = seed();
    v.snapshot.basis.ingredients = "가".repeat(24000);
    state.versions = [v];
    state.ai = true;
    expect(
      (
        await POST(
          req({
            operation: "regenerate_section",
            baseId: v.id,
            sectionId: v.snapshot.sections[1].id,
            consent: true,
          }),
        )
      ).status,
    ).toBe(413);
    expect(state.reserve).not.toHaveBeenCalled();
    expect(state.regenerate).not.toHaveBeenCalled();
  });

  it("구좌 재생성은 지정한 승인 전 구좌만 바꾸고 다른 승인을 보존한다", async () => {
    const v = seed();
    v.snapshot = changeApproval(
      v.snapshot,
      v.snapshot.sections[0].id,
      true,
      ids.user,
    );
    state.versions = [v];
    state.ai = true;
    const section = v.snapshot.sections[1];
    state.regenerate.mockResolvedValue({
      ...section,
      headline: "다시 만든 제목",
    });
    const r = await POST(
      req({
        operation: "regenerate_section",
        baseId: v.id,
        sectionId: section.id,
        consent: true,
      }),
    );
    expect(r.status).toBe(200);
    expect(state.versions[1].snapshot.sections[0]).toEqual(
      v.snapshot.sections[0],
    );
    expect(state.versions[1].snapshot.sections[1].headline).toBe(
      "다시 만든 제목",
    );
    expect(v.snapshot.sections[1].headline).not.toBe("다시 만든 제목");
  });
  it("승인 구좌의 재생성·동의 누락·잘못된 AI 수치 결과를 저장하지 않는다", async () => {
    const v = seed();
    v.snapshot = changeApproval(
      v.snapshot,
      v.snapshot.sections[0].id,
      true,
      ids.user,
    );
    state.versions = [v];
    state.ai = true;
    expect(
      (
        await POST(
          req({
            operation: "regenerate_section",
            baseId: v.id,
            sectionId: v.snapshot.sections[0].id,
            consent: true,
          }),
        )
      ).status,
    ).toBe(409);
    expect(state.regenerate).not.toHaveBeenCalled();
    const section = v.snapshot.sections[1];
    expect(
      (
        await POST(
          req({
            operation: "regenerate_section",
            baseId: v.id,
            sectionId: section.id,
          }),
        )
      ).status,
    ).toBe(400);
    state.regenerate.mockResolvedValue({ ...section, body: "개선 99.9%" });
    expect(
      (
        await POST(
          req({
            operation: "regenerate_section",
            baseId: v.id,
            sectionId: section.id,
            consent: true,
          }),
        )
      ).status,
    ).toBe(422);
    expect(state.inserts).toHaveLength(0);
    expect(state.finish).not.toHaveBeenCalled();
  });
  it("출처·로그인·회사 경계를 확인하고 저장하지 않는다", async () => {
    expect(
      (
        await POST(
          req({ operation: "manual", baseId: null }, "https://other.example"),
        )
      ).status,
    ).toBe(403);
    state.auth = false;
    expect((await POST(req({ operation: "read" }))).status).toBe(401);
    state.auth = true;
    state.visible = false;
    expect(
      (await POST(req({ operation: "manual", baseId: null }))).status,
    ).toBe(404);
    expect(state.inserts).toEqual([]);
  });
  it("연결 전에는 새 테이블에 쓰지 않고 AI를 호출하지 않는다", async () => {
    vi.stubEnv("ENABLE_PLAN_STORAGE", "false");
    expect(
      (await POST(req({ operation: "manual", baseId: null }))).status,
    ).toBe(503);
    expect(state.inserts).toEqual([]);
    expect(state.generate).not.toHaveBeenCalled();
  });
  it("직접 기획을 실제 제품 기준의 첫 버전으로 저장한다", async () => {
    const r = await POST(req({ operation: "manual", baseId: null }));
    expect(r.status).toBe(200);
    expect(state.inserts[0]).toMatchObject({
      created_by: ids.user,
      project_id: ids.project,
      product_id: ids.product,
      revision: 1,
      action: "create",
      parent_id: null,
    });
    expect(state.generate).not.toHaveBeenCalled();
  });
  it("오래된 기준 버전은 덮어쓰지 않는다", async () => {
    state.versions = [seed()];
    expect(
      (await POST(req({ operation: "manual", baseId: null }))).status,
    ).toBe(409);
    expect(state.inserts).toEqual([]);
  });
  it("승인한 구좌를 편집 요청으로 몰래 바꾸지 못한다", async () => {
    const v = seed();
    v.snapshot = changeApproval(
      v.snapshot,
      v.snapshot.sections[0].id,
      true,
      ids.user,
    );
    state.versions = [v];
    const changed = structuredClone(v.snapshot);
    changed.sections[0].body = "몰래 수정";
    expect(
      (await POST(req({ operation: "edit", baseId: v.id, snapshot: changed })))
        .status,
    ).toBe(422);
    expect(state.inserts).toEqual([]);
  });
  it("복구는 이전 버전을 그대로 둔 채 새 버전을 추가한다", async () => {
    const first = seed();
    const second = {
      ...structuredClone(first),
      id: crypto.randomUUID(),
      revision: 2,
      parent_id: first.id,
    };
    second.snapshot.coreUsp = "다른 기획";
    state.versions = [first, second];
    const r = await POST(
      req({ operation: "restore", baseId: second.id, versionId: first.id }),
    );
    expect(r.status).toBe(200);
    expect(state.versions).toHaveLength(3);
    expect(state.inserts[0]).toMatchObject({
      revision: 3,
      parent_id: second.id,
      restored_from: first.id,
      snapshot: first.snapshot,
    });
    expect(second.snapshot.coreUsp).toBe("다른 기획");
  });
  it("읽기 결과는 캐시하지 않고 다른 제품 버전은 읽을 수 없다", async () => {
    const v = seed();
    state.versions = [v];
    const r = await POST(req({ operation: "read" }));
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(
      (await POST(req({ operation: "read", versionId: crypto.randomUUID() })))
        .status,
    ).toBe(404);
  });
  it("동시 저장 충돌은 재시도 가능한 오류로 알린다", async () => {
    state.conflict = true;
    expect(
      (await POST(req({ operation: "manual", baseId: null }))).status,
    ).toBe(409);
  });
  it("AI를 활성화하지 않았으면 새 기획 요청도 유료 호출하지 않는다", async () => {
    expect(
      (await POST(req({ operation: "generate", baseId: null, consent: true })))
        .status,
    ).toBe(503);
    expect(state.generate).not.toHaveBeenCalled();
    expect(state.inserts).toEqual([]);
  });
});
