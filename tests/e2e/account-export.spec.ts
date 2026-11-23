// Why this exists: the account settings page's "Download your data" link saves the
// export as a file, and the page stays free of axe findings in both schemes.
// The account and the export answer are mocked here.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

test.beforeEach(async ({ page }) => {
  await page.goto("/account/settings/");
  await page.context().addCookies([{ name: "signed_in", value: "1", url: page.url() }]);
  await page.route("**/api/me/", (r) =>
    r.fulfill({
      json: {
        email: "learner@example.com",
        pro: false,
        proStatus: null,
        proUntil: null,
        news: false,
        hasPassword: true,
      },
    }),
  );
  await page.route("**/api/progress/", (r) => r.fulfill({ json: {} }));
  await page.route("**/api/daily/", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/certificates/", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/account/export/", (r) =>
    r.fulfill({
      json: { exportedAt: "2026-11-15T10:00:00.000Z", profile: { email: "learner@example.com" } },
      headers: {
        "Content-Disposition": 'attachment; filename="excelexercises-data-2026-11-15.json"',
      },
    }),
  );
});

test("Download your data saves the export as a file", async ({ page, browserName }) => {
  await page.reload();
  const link = page.getByRole("link", { name: "Download your data" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/api/account/export/");
  await expect(link).toHaveAttribute("download", "");
  await expect(page.getByText("Progress saved only in a browser")).toBeVisible();
  // Chromium and WebKit fetch an <a download> outside Playwright's routes, so
  // the mocked file can only be caught in Firefox.
  if (browserName !== "firefox") return;
  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(download.suggestedFilename()).toBe("excelexercises-data-2026-11-15.json");
});

test("the signed-in account settings page has no axe findings in either scheme", async ({
  page,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    // Reduced motion: the cards' scroll fade-in would read as low contrast.
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.reload();
    await expect(page.getByRole("link", { name: "Download your data" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  }
});
