import { test, expect } from "@playwright/test";
import { buildSync } from "esbuild";
import { readFileSync } from "node:fs";
import {
  changeApproval,
  createDocument,
  editDocument,
  manualPlan,
  type PlanVersion,
} from "../../src/lib/plan-document";
const bundle = buildSync({
  entryPoints: ["tests/fixtures/planning-entry.tsx"],
  bundle: true,
  write: false,
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
}).outputFiles[0].text;
const css = readFileSync("src/app/globals.css", "utf8").replace(
  /^@import[^;]+;/m,
  "",
);
const basis = {
  productId: "d2000000-0000-4000-8000-000000000001",
  brand: "로컬 자동 검사",
  name: "검사 제품",
  category: "페이스 클렌징",
  subtype: "폼",
  ingredients: "정제수, 글리세린",
};
const user = "d3000000-0000-4000-8000-000000000001";
test("실제 편집 화면에서 저장·승인·해제·이전 버전 복구와 내보내기가 연결된다", async ({
  page,
}) => {
  const first: PlanVersion = {
    id: crypto.randomUUID(),
    project_id: "d1000000-0000-4000-8000-000000000001",
    product_id: basis.productId,
    revision: 1,
    action: "create",
    parent_id: null,
    restored_from: null,
    changed_section_id: null,
    snapshot: createDocument(manualPlan(basis), basis, []),
    created_by: user,
    created_at: new Date().toISOString(),
  };
  const versions = [first];
  await page.route("**/api/plans", async (route) => {
    const input = route.request().postDataJSON();
    const latest = versions.at(-1)!;
    if (input.operation === "read") {
      const version = versions.find((v) => v.id === input.versionId) ?? latest;
      return route.fulfill({
        json: { version, latestId: latest.id, history: versions.toReversed() },
      });
    }
    if (input.baseId !== latest.id)
      return route.fulfill({
        status: 409,
        json: { error: "최신 버전을 불러와 주세요." },
      });
    const snapshot =
      input.operation === "edit"
        ? editDocument(latest.snapshot, input.snapshot)
        : input.operation === "restore"
          ? structuredClone(
              versions.find((v) => v.id === input.versionId)!.snapshot,
            )
          : changeApproval(
              latest.snapshot,
              input.sectionId,
              input.operation === "approve",
              user,
            );
    const version: PlanVersion = {
      ...latest,
      id: crypto.randomUUID(),
      snapshot,
      revision: latest.revision + 1,
      parent_id: latest.id,
      action: input.operation,
      restored_from: input.versionId ?? null,
      changed_section_id: input.sectionId ?? null,
    };
    versions.push(version);
    await route.fulfill({ json: { version } });
  });
  await page.route("**/__planning-test*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main style="max-width:1000px;margin:auto;padding:20px"><div id="root"></div></main><script>${bundle.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
    }),
  );
  await page.goto("/__planning-test");
  const headline = page.getByRole("textbox", {
    name: "구좌 1 제목",
    exact: true,
  });
  await expect(headline).toBeVisible();
  await headline.fill("매일의 세정 루틴");
  await page
    .getByRole("textbox", { name: "구좌 1 본문", exact: true })
    .fill("제품 정보를 확인하고 작성한 첫 구좌입니다.");
  await page
    .getByRole("textbox", { name: "구좌 1 비주얼 가이드", exact: true })
    .fill("제품 단독 이미지와 부드러운 배경");
  const approve = page
    .getByRole("button", { name: "내용 확인 후 구좌 승인", exact: true })
    .first();
  await expect(approve).toBeDisabled();
  await expect(page.getByLabel("저장된 버전")).toBeDisabled();
  await page
    .getByRole("button", { name: "변경 내용 저장", exact: true })
    .click();
  await expect(
    page.getByText("버전 2으로 저장했습니다.", { exact: false }),
  ).toBeVisible();
  await approve.click();
  await expect(headline).toBeDisabled();
  await expect(
    page.getByText("1 / 8 구좌 승인", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "승인 해제하고 수정", exact: true })
    .click();
  await expect(headline).toBeEnabled();
  await headline.fill("수정한 첫 구좌");
  await page
    .getByRole("button", { name: "변경 내용 저장", exact: true })
    .click();
  await page.getByLabel("저장된 버전").selectOption(versions[2].id);
  await expect(headline).toBeDisabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "이 버전으로 복구", exact: true })
    .click();
  await expect(headline).toHaveValue("매일의 세정 루틴");
  await expect(headline).toBeDisabled();
  expect(versions).toHaveLength(6);
  expect(versions[4].snapshot.sections[0].headline).toBe("수정한 첫 구좌");
  expect(versions[5].snapshot).toEqual(versions[2].snapshot);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "제작용 기획서 내려받기", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "상세페이지_기획서_v6.html",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("저장 충돌이 발생해도 수정 내용을 유지하고 백업할 수 있다", async ({
  page,
}) => {
  const version: PlanVersion = {
    id: crypto.randomUUID(),
    project_id: "d1000000-0000-4000-8000-000000000001",
    product_id: basis.productId,
    revision: 1,
    action: "create",
    parent_id: null,
    restored_from: null,
    changed_section_id: null,
    snapshot: createDocument(manualPlan(basis), basis, []),
    created_by: user,
    created_at: new Date().toISOString(),
  };
  await page.route("**/api/plans", (route) => {
    const op = route.request().postDataJSON().operation;
    return route.fulfill(
      op === "read"
        ? { json: { version, latestId: version.id, history: [version] } }
        : {
            status: 409,
            json: { error: "다른 창에서 새 버전을 저장했습니다." },
          },
    );
  });
  await page.route("**/__planning-test*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body><div id="root"></div><script>${bundle.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
    }),
  );
  await page.goto("/__planning-test");
  const headline = page.getByLabel("구좌 1 제목", { exact: true });
  await headline.fill("잃으면 안 되는 수정");
  await page
    .getByRole("button", { name: "변경 내용 저장", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("다른 창");
  await expect(headline).toHaveValue("잃으면 안 되는 수정");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "미저장 내용 백업", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "미저장_기획_백업.json",
  );
});

test("AI 완료 응답을 놓쳐도 같은 요청 상태만 확인하고 재호출하지 않는다", async ({
  page,
}) => {
  const first: PlanVersion = {
    id: crypto.randomUUID(),
    project_id: "d1000000-0000-4000-8000-000000000001",
    product_id: basis.productId,
    revision: 1,
    action: "create",
    parent_id: null,
    restored_from: null,
    changed_section_id: null,
    snapshot: createDocument(manualPlan(basis), basis, []),
    created_by: user,
    created_at: new Date().toISOString(),
  };
  let latest = first;
  let requestId: string | null = null;
  let providerCalls = 0;
  let checks = 0;
  await page.route("**/api/plans", (route) => {
    const input = route.request().postDataJSON();
    if (input.operation === "read")
      return route.fulfill({
        json: {
          version: latest,
          latestId: latest.id,
          history: latest.id === first.id ? [first] : [latest, first],
        },
      });
    if (input.checkOnly) {
      checks++;
      expect(input.requestId).toBe(requestId);
      return route.fulfill({ json: { version: latest, replayed: true } });
    }
    if (input.operation === "regenerate_section") {
      providerCalls++;
      requestId = input.requestId;
      latest = {
        ...structuredClone(first),
        id: crypto.randomUUID(),
        revision: 2,
        parent_id: first.id,
        action: "regenerate_section",
        changed_section_id: input.sectionId,
      };
      latest.snapshot.sections[0].headline = "저장된 생성 결과";
      return route.fulfill({
        status: 503,
        json: { error: "결과 저장의 응답을 확인하지 못했습니다." },
      });
    }
    return route.fulfill({
      status: 400,
      json: { error: "예상하지 못한 요청" },
    });
  });
  await page.route("**/__planning-test*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${bundle.replace(/<\/script/gi, "<\\/script")}</script></body></html>`,
    }),
  );
  await page.goto("/__planning-test?ai=1");
  await page
    .getByRole("checkbox", { name: /제품 브리프와 승인된 근거/ })
    .check();
  await page
    .getByRole("button", { name: "이 구좌만 AI 재생성", exact: true })
    .first()
    .click();
  await expect(page.getByRole("alert")).toContainText("응답");
  await expect(
    page
      .getByRole("button", { name: "이 구좌만 AI 재생성", exact: true })
      .first(),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "이전 요청 상태 확인", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "구좌 1 제목", exact: true }),
  ).toHaveValue("저장된 생성 결과");
  await expect(
    page.getByRole("region", { name: "AI 요청 확인", exact: true }),
  ).toHaveCount(0);
  expect(providerCalls).toBe(1);
  expect(checks).toBe(1);
});
