import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    {
      name: "데스크톱",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "모바일",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: "chrome",
      },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command:
          "node node_modules/next/dist/bin/next start --hostname 127.0.0.1",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
      },
});
