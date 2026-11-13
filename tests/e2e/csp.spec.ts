// Why this exists: the live site sends the Content-Security-Policy from
// vercel.json, but the preview server does not. This adds that header to every
// page and fails on the first script, style or request the policy blocks.
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { allRoutes } from "./routes.ts";

const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const POLICY =
  config.headers
    .find((h) => h.source === "/(.*)")
    ?.headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "";

/** Serves every response with the policy and records what the browser blocks. */
async function withPolicy(page: Page): Promise<string[]> {
  const blocked: string[] = [];
  await page.route("**/*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": POLICY },
    });
  });
  await page.exposeFunction("reportBlocked", (line: string) => blocked.push(line));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      const report = (window as unknown as { reportBlocked: (line: string) => void }).reportBlocked;
      report(`${e.violatedDirective} ${e.blockedURI} ${e.sample}`);
    });
  });
  return blocked;
}

test("the policy is set", () => {
  expect(POLICY).toMatch(/^default-src 'self';/u);
});

for (const route of allRoutes()) {
  test(`the content security policy blocks nothing: ${route}`, async ({ page }) => {
    const blocked = await withPolicy(page);
    await page.goto(route, { waitUntil: "networkidle" });
    expect(blocked).toEqual([]);
  });
}

test("an exercise still checks a formula under the policy", async ({ page }) => {
  const blocked = await withPolicy(page);
  await page.goto("/exercises/add-two-cells/");
  await page.locator("#formula").fill("=B2+B3");
  await page.locator("#formula").press("Enter");
  await expect(page.locator("[data-status]").first()).toContainText("Correct.");
  expect(blocked).toEqual([]);
});
