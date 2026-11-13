// Why this exists: end-to-end checks against the built site on the three
// browser engines: accessibility, the no-third-party rule and page metadata.
import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets the suite run beside a dev server that already holds 4321.
const PORT = Number(process.env["E2E_PORT"] ?? 4321);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `node tools/serve-static.ts ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env["CI"],
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
