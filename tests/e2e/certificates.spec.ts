// Why this exists: certificates end to end. The public page says Valid,
// Revoked or that no certificate has the number, shows no account data and
// asks search engines not to list it. The account page lists the user's
// certificates with copy-link and revoke, and a passed timed PRO run offers
// one. The public pages come from the built function against the fixtures in
// tools/lib/ssr.ts; the account and the API answers are mocked here.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const VALID = "/certificates/ValidCertificate000001/";
const REVOKED = "/certificates/RevokedCertificate0001/";
const UNKNOWN = "/certificates/UnknownCertificate0001/";

/** axe in both schemes, with nothing left over. Each scheme loads fresh. */
async function axe(page: Page, ready: string, scope?: string) {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.reload();
    await expect(page.locator(ready).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const builder = new AxeBuilder({ page }).withTags(TAGS);
    const { violations } = await (scope ? builder.include(scope) : builder).analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  }
}

async function signIn(page: Page, pro: boolean) {
  await page.context().addCookies([{ name: "signed_in", value: "1", url: page.url() }]);
  await page.route("**/api/me/", (r) =>
    r.fulfill({
      json: {
        email: "learner@example.com",
        pro,
        proStatus: pro ? "active" : null,
        proUntil: null,
        news: false,
        hasPassword: true,
      },
    }),
  );
  await page.route("**/api/progress/", (r) => r.fulfill({ json: {} }));
  await page.route("**/api/daily/", (r) => r.fulfill({ json: [] }));
}

const valid = {
  id: "ValidCertificate000001",
  name: "Ada Lovelace",
  assessment: "office-essentials",
  assessment_title: "Office essentials",
  score: 9,
  total: 10,
  time_limit_s: 1800,
  issued_at: "2026-11-15T10:21:00.000Z",
  revoked_at: null as string | null,
};
const revoked = {
  ...valid,
  id: "RevokedCertificate0001",
  assessment: "data-analyst",
  assessment_title: "Data analyst",
  revoked_at: "2026-11-01T12:00:00.000Z",
};

test.describe("the public certificate page", () => {
  test("a valid certificate shows the name, the pass, the date and Valid, and nothing else", async ({
    page,
  }) => {
    const res = await page.goto(VALID);
    expect(res?.status()).toBe(200);
    expect(res?.headers()["x-robots-tag"]).toBe("noindex");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ada Lovelace");
    const main = page.locator("main");
    await expect(main).toContainText(
      "passed the Office essentials mock assessment on excelexercises.online on 15 November 2026, with 9 of 10 tasks right in a timed 30-minute run.",
    );
    await expect(main.locator("dd").first()).toHaveText("Valid");
    await expect(main).toContainText("ValidCertificate000001");
    await expect(main).toContainText("nobody supervised it");
    await expect(main).not.toContainText("@");
    await expect(main).not.toContainText(/certified/iu);
    await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
    await axe(page, "h1");
  });

  test("a revoked certificate says so, with the date", async ({ page }) => {
    const res = await page.goto(REVOKED);
    expect(res?.status()).toBe(200);
    await expect(page.locator("main dd").first()).toHaveText("Revoked on 1 November 2026");
    await axe(page, "h1");
  });

  test("an unknown number is a plain 404", async ({ page }) => {
    for (const path of [UNKNOWN, "/certificates/not-a-number/"]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Certificate not found");
      await expect(page.locator("main")).toContainText("No certificate has this number.");
    }
    await axe(page, "h1");
  });

  test("printing hides the site chrome and the button", async ({ page }) => {
    await page.goto(VALID);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeHidden();
    await expect(page.locator("body > header").first()).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("the account certificates page", () => {
  test("lists certificates, copies a link and revokes after a confirm", async ({
    page,
    browserName,
  }) => {
    await page.goto("/account/certificates/");
    await signIn(page, true);
    const rows = [{ ...valid }, { ...revoked }];
    const patches: unknown[] = [];
    await page.route("**/api/certificates/", (r) => {
      if (r.request().method() === "PATCH") {
        patches.push(r.request().postDataJSON());
        return r.fulfill({ json: { id: valid.id, revoked_at: "2026-11-16T09:00:00.000Z" } });
      }
      return r.fulfill({ json: rows });
    });
    await page.reload();
    const card = page.locator("[data-certs]");
    await expect(page.getByRole("heading", { name: "Your certificates" })).toBeVisible();
    const items = card.locator("[data-certs-list] > li");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0).getByRole("link", { name: "Office essentials" })).toHaveAttribute(
      "href",
      VALID,
    );
    await expect(items.nth(0)).toContainText("Ada Lovelace, 9 of 10, 15 November 2026, valid");
    await expect(items.nth(1)).toContainText("revoked on 1 November 2026");
    await expect(items.nth(1).getByRole("button", { name: /^Revoke/u })).toHaveCount(0);
    await expect(card.locator("[data-certs-empty]")).toBeHidden();
    await axe(page, "[data-certs-list] > li >> nth=1");

    if (browserName === "chromium")
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const first = items.nth(0);
    await first
      .getByRole("button", { name: "Copy link to the Office essentials certificate" })
      .click();
    // Where the browser blocks the clipboard, the link is shown instead.
    await expect(first.getByRole("status")).toContainText(/Link copied\.|ValidCertificate000001/u);

    // Revoke asks first; Keep puts it back.
    await first.getByRole("button", { name: "Revoke the Office essentials certificate" }).click();
    await expect(first.getByRole("status")).toContainText("This cannot be undone.");
    await first.getByRole("button", { name: "Keep" }).click();
    await expect(
      first.getByRole("button", { name: "Revoke the Office essentials certificate" }),
    ).toBeFocused();
    expect(patches).toEqual([]);
    await first.getByRole("button", { name: "Revoke the Office essentials certificate" }).click();
    await first.getByRole("button", { name: "Revoke", exact: true }).click();
    await expect(first).toContainText("revoked on 16 November 2026");
    await expect(first.getByRole("button", { name: /^Revoke/u })).toHaveCount(0);
    expect(patches).toEqual([{ id: valid.id }]);
  });

  test("a free account sees how to get one", async ({ page }) => {
    await page.goto("/account/certificates/");
    await signIn(page, false);
    await page.route("**/api/certificates/", (r) => r.fulfill({ json: [] }));
    await page.reload();
    const empty = page.locator("[data-certs-empty]");
    await expect(empty).toContainText("Pass a timed mock assessment with 80% or more");
    await expect(empty.getByRole("link", { name: "PRO" })).toBeVisible();
    await expect(page.locator("[data-certs-list]")).toBeHidden();
  });
});

test("a passed timed PRO run offers a certificate with the typed name", async ({
  page,
  browserName,
}) => {
  await page.goto("/mock-assessments/office-essentials/");
  await signIn(page, true);
  const attemptId = "11111111-2222-4333-8444-555555555555";
  const claims: unknown[] = [];
  const saves: { formulas?: unknown; startToken?: unknown }[] = [];
  await page.route("**/api/assessments/start/", (r) =>
    r.fulfill({ json: { token: `${Date.now()}.${"a".repeat(43)}` } }),
  );
  await page.route("**/api/assessments/", (r) => {
    if (r.request().method() === "GET") return r.fulfill({ json: [] });
    saves.push(r.request().postDataJSON());
    return r.fulfill({ status: 201, json: { saved: true, id: attemptId, score: 9, total: 10 } });
  });
  await page.route("**/api/certificates/", (r) => {
    if (r.request().method() === "GET") return r.fulfill({ json: [] });
    claims.push(r.request().postDataJSON());
    return r.fulfill({ status: 201, json: { ...valid, url: VALID } });
  });
  await page.reload();
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  // The server's start token is kept with the run before it ends.
  await expect
    .poll(() =>
      page.evaluate(() => sessionStorage.getItem("formula-practice:assessment:office-essentials")),
    )
    .toContain("startToken");
  await page.locator("#t1-formula").fill("=1");
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: /^Finish with/u }).click();

  const offer = page.locator("[data-cert]");
  await expect(offer).toContainText("You passed with 9 of 10.");
  expect(saves[0]?.formulas).toHaveLength(10);
  expect(String(saves[0]?.startToken)).toMatch(/^\d{13}\./u);
  const name = offer.getByLabel("Name to print on your certificate");
  await offer.getByRole("button", { name: "Get certificate" }).click();
  await expect(offer.getByRole("status")).toHaveText("Type the name to print.");
  await expect(name).toBeFocused();
  await name.fill("Ada Lovelace");
  await offer.getByRole("button", { name: "Get certificate" }).click();
  await expect(offer.getByRole("link", { name: "View your certificate" })).toHaveAttribute(
    "href",
    VALID,
  );
  expect(claims).toEqual([{ attempt: attemptId, name: "Ada Lovelace" }]);
  // After a reload the offer is back (the mock still lists no certificate).
  // Only the offer: the rest of the result page has its own checks. Firefox
  // crashes the long result page inside axe now and then, so it is checked
  // on the other engines.
  if (browserName !== "firefox") await axe(page, "[data-cert] button", "[data-cert]");
});
