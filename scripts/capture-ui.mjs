import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1050 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("제품의 가능성을");
    await page.screenshot({
      path: `artifacts/home-${name}.png`,
      fullPage: true,
    });
    await page.goto(`${baseUrl}/brief-preview`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("제품의 이야기를");
    await page.getByLabel("세부 품목", { exact: true }).selectOption("오일");
    await page.screenshot({
      path: `artifacts/brief-${name}.png`,
      fullPage: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
