import { test, expect } from "@playwright/test";
test("홈에서 로그인으로 이동하고 비로그인 프로젝트 접근을 차단한다", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "제품의 가능성을",
  );
  await page.getByRole("link", { name: "프로젝트 시작하기" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("이메일", { exact: true })).toBeVisible();
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/login$/);
});
test("오일 품목에 맞게 질문을 바꾸고 브리프를 검증한다", async ({ page }) => {
  await page.goto("/brief-preview");
  await page.getByLabel("세부 품목", { exact: true }).selectOption("오일");
  for (const label of [
    "유화 속도",
    "물로 씻어낼 때의 사용감",
    "세안 후 마무리감",
  ])
    await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  await expect(page.getByLabel("거품 특성", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("제품명 필수", { exact: true })
    .fill("테스트 클렌징 오일");
  await page
    .getByLabel("전성분 전체 필수", { exact: true })
    .fill("정제수, 글리세린");
  await page.getByRole("button", { name: "입력 확인하기" }).click();
  await expect(
    page.getByText("입력 형식이 올바릅니다.", { exact: false }),
  ).toBeVisible();
});
test("모든 품목의 직접 입력과 거품 질문이 동작한다", async ({ page }) => {
  await page.goto("/brief-preview");
  await expect(page.getByLabel("거품 특성", { exact: true })).toBeVisible();
  await page
    .getByLabel("대카테고리", { exact: true })
    .selectOption("헤어·바디");
  await expect(page.getByLabel("거품 특성", { exact: true })).toBeVisible();
  await page.getByLabel("세부 품목", { exact: true }).selectOption("기타");
  await page
    .getByLabel("직접 입력한 품목", { exact: true })
    .fill("새로운 세정 제품");
  await expect(
    page.getByLabel("직접 입력한 품목", { exact: true }),
  ).toHaveValue("새로운 세정 제품");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("외부 출처의 파일 요청을 거절한다", async ({ request }) => {
  const response = await request.post("/api/files", {
    headers: { origin: "https://untrusted.example" },
    data: { operation: "download" },
  });
  expect(response.status()).toBe(403);
});
