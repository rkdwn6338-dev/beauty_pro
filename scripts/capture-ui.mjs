import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1050 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
    await page.screenshot({
      path: `artifacts/home-${name}.png`,
      fullPage: true,
    });
    await page.goto("http://127.0.0.1:3000/brief-preview", {
      waitUntil: "networkidle",
    });
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
