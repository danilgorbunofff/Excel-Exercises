// Why this exists: the signed-in account area. Every page of the left menu
// fills from the (mocked) account, the plan states show the right billing, the
// settings cards read the account's choices, and each page stays free of axe
// findings in both schemes and of sideways scroll on a phone.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const PAGES = [
  ["/account/", "Overview"],
  ["/account/progress/", "Progress"],
  ["/account/daily/", "Daily exercise"],
  ["/account/certificates/", "Certificates"],
  ["/account/billing/", "Plan and billing"],
  ["/account/settings/", "Account settings"],
] as const;

type Plan = "free" | "monthly" | "lifetime";

async function signIn(page: Page, plan: Plan, path: string) {
  await page.goto(path);
  await page.context().addCookies([{ name: "signed_in", value: "1", url: page.url() }]);
  await page.route("**/api/me/", (r) =>
    r.fulfill({
      json: {
        email: "learner@example.com",
        pro: plan !== "free",
        proStatus: plan === "free" ? null : plan === "lifetime" ? "lifetime" : "active",
        proUntil: plan === "monthly" ? "2026-12-01T00:00:00.000Z" : null,
        news: false,
        digest: true,
        daily: false,
        dailyAsked: plan !== "lifetime",
        hasPassword: true,
        createdAt: "2026-11-01T10:00:00.000Z",
      },
    }),
  );
  await page.route("**/api/progress/", (r) => r.fulfill({ json: {} }));
  await page.route("**/api/daily/", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/certificates/", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/assessments/", (r) =>
    r.fulfill({
      json: [
        {
          id: "11111111-2222-4333-8444-555555555555",
          assessment: "office-essentials",
          started_at: "2026-11-18T09:00:00.000Z",
          finished_at: "2026-11-18T09:25:30.000Z",
          time_limit_s: 1800,
          score: 9,
          total: 10,
        },
      ],
    }),
  );
  await page.route("**/api/billing/", (r) =>
    r.fulfill({
      json: {
        plan: plan === "free" ? null : plan,
        renews: plan === "monthly" ? "2026-12-01T00:00:00.000Z" : null,
        ending: false,
        card: plan === "free" ? null : { brand: "visa", last4: "4242", expMonth: 8, expYear: 2028 },
        payments:
          plan === "free"
            ? []
            : [
                {
                  date: "2026-11-01T10:00:00.000Z",
                  amountCents: plan === "lifetime" ? 12900 : 1500,
                  currency: "usd",
                  description: "PRO",
                  status: "paid",
                  receiptUrl: "https://pay.stripe.com/receipts/x",
                },
              ],
      },
    }),
  );
  await page.reload();
}

test("the left menu reaches every account page and marks the current one", async ({ page }) => {
  await signIn(page, "lifetime", "/account/");
  const menu = page.getByRole("navigation", { name: "Your account" });
  await expect(menu.getByRole("link")).toHaveText(PAGES.map(([, name]) => name));
  for (const [path, name] of PAGES) {
    await menu.getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`, "u"));
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(menu.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
  }
});

test("the overview shows what to do next, the plan and recent results", async ({ page }) => {
  await signIn(page, "monthly", "/account/");
  await expect(page.locator("[data-next-label]")).toHaveText("Start here");
  await expect(page.locator("[data-daily-ask]")).toBeHidden();
  await expect(page.locator("[data-plan-line]")).toHaveText(
    "Your PRO plan renews or ends on 1 December 2026.",
  );
  await expect(page.locator("[data-fig=due]")).toHaveText("0");
  await expect(page.locator("[data-recent]")).toContainText("Office essentials");
  await expect(page.locator("[data-recent]")).toContainText("9 of 10, 90%");
});

test("billing follows the plan", async ({ page }) => {
  await signIn(page, "free", "/account/billing/");
  await expect(page.locator('[data-cur="free"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose a plan" })).toBeVisible();
  await expect(page.locator("[data-pay]")).toBeHidden();

  await signIn(page, "monthly", "/account/billing/");
  await expect(page.locator("[data-sub-name]")).toHaveText("PRO, monthly");
  await expect(page.locator("[data-sub-renew]")).toHaveText("Renews on 1 Dec 2026.");
  await expect(page.locator('[data-plan-card="monthly"] [data-current]')).toBeVisible();
  await expect(page.locator("[data-card-line]")).toHaveText("Visa ending 4242");
  await expect(page.locator("[data-payments]")).toContainText("$15");

  await signIn(page, "lifetime", "/account/billing/");
  await expect(page.locator('[data-cur="lifetime"]')).toBeVisible();
  await expect(page.locator("[data-plans]")).toBeHidden();
  await expect(page.locator("[data-payments]")).toContainText("$129");
});

test("settings read the account's choices and guard delete", async ({ page }) => {
  await signIn(page, "free", "/account/settings/");
  await expect(page.getByRole("radio", { name: "Daily exercise" })).not.toBeChecked();
  await expect(page.getByRole("radio", { name: "Weekly progress" })).toBeChecked();
  const del = page.getByRole("button", { name: "Delete my account" });
  await expect(del).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("delete");
  await expect(del).toBeEnabled();
});

test("an account that never answered is asked once about the daily email", async ({ page }) => {
  await signIn(page, "lifetime", "/account/");
  const ask = page.locator("[data-daily-ask]");
  await expect(ask).toBeVisible();
  await expect(
    ask.getByRole("switch", { name: "Get the daily exercise by email?" }),
  ).not.toBeChecked();
});

test("a timed pass with no certificate can be claimed", async ({ page }) => {
  await signIn(page, "lifetime", "/account/certificates/");
  await page.getByRole("button", { name: "Claim certificate" }).click();
  await expect(page.getByLabel("Name to print on your certificate")).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`every account page has no axe findings in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await signIn(page, "monthly", "/account/");
    for (const [path] of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(
        violations.map(
          (v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        ),
      ).toEqual([]);
    }
  });
}

test("no account page scrolls sideways on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "monthly", "/account/");
  for (const [path] of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(wide, path).toBeLessThanOrEqual(0);
  }
});

test("signed out, an account page asks to log in", async ({ page }) => {
  await page.goto("/account/billing/");
  await expect(page.getByRole("link", { name: "Log in" }).last()).toHaveAttribute(
    "href",
    "/login/?next=%2Faccount%2Fbilling%2F",
  );
});
