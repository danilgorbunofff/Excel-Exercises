// Why this exists: every feature must be one or two clicks from any page. The
// header panels open and close by mouse and by keyboard, the phone menu shows
// the same groups, the Practice pages share a row of tabs, and the header
// keeps one row at every width.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { LEARN_NAV, PRACTICE_NAV } from "../../src/lib/nav.ts";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const practiceButton = (page: Page) =>
  page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Practice" });
const panel = (page: Page, id: string) => page.locator(`#nav-${id}`);

test("the Practice and Learn panels open by mouse and close on Escape or a click outside", async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/functions/");
  const practice = practiceButton(page);
  await expect(practice).toHaveAttribute("aria-expanded", "false");
  await practice.click();
  await expect(panel(page, "practice")).toBeVisible();
  await expect(practice).toHaveAttribute("aria-expanded", "true");
  for (const item of PRACTICE_NAV) {
    await expect(panel(page, "practice").getByRole("link", { name: item.label })).toHaveAttribute(
      "href",
      item.href,
    );
    await expect(panel(page, "practice").getByText(item.description)).toBeVisible();
  }

  // Opening Learn closes Practice.
  await page.getByRole("button", { name: "Learn" }).click();
  await expect(panel(page, "learn")).toBeVisible();
  await expect(panel(page, "practice")).toBeHidden();
  await expect(panel(page, "learn").getByRole("link")).toHaveCount(LEARN_NAV.length);
  // The page's own section is marked.
  await expect(panel(page, "learn").getByRole("link", { name: "Functions" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.keyboard.press("Escape");
  await expect(panel(page, "learn")).toBeHidden();
  // Safari does not focus a button on a mouse click, so focus has nowhere to return.
  if (browserName !== "webkit") {
    await expect(page.getByRole("button", { name: "Learn" })).toBeFocused();
  }

  await practice.click();
  await page.mouse.click(640, 700);
  await expect(panel(page, "practice")).toBeHidden();
  await expect(practice).toHaveAttribute("aria-expanded", "false");
});

test("a keyboard reaches a panel link and comes back with Escape", async ({
  page,
  browserName,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const practice = practiceButton(page);
  await practice.focus();
  await page.keyboard.press("Enter");
  await expect(panel(page, "practice")).toBeVisible();
  // WebKit only moves to links with Alt+Tab unless the user changed a setting.
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(panel(page, "practice").getByRole("link", { name: "Exercises" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel(page, "practice")).toBeHidden();
  await expect(practice).toBeFocused();
  await practice.press("Enter");
  await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/exercises\/$/u);
});

test("signed in, the Account button opens the account links", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
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
  await page.reload();
  const account = page.getByRole("button", { name: "Account" });
  await account.focus();
  await account.press("Enter");
  const you = panel(page, "you");
  await expect(you).toBeVisible();
  await expect(you.getByRole("link")).toHaveText(["Profile", "Certificates", "Account settings"]);
  await expect(you.getByRole("button", { name: "Log out" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(you).toBeHidden();
  await expect(account).toBeFocused();
});

test("the phone menu shows the Practice and Learn groups", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/daily/");
  await page.getByRole("button", { name: "Menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog.getByRole("heading", { name: "Practice" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Learn" })).toBeVisible();
  for (const item of [...PRACTICE_NAV, ...LEARN_NAV]) {
    await expect(dialog.getByRole("link", { name: item.label, exact: true })).toBeAttached();
  }
  await expect(dialog.getByRole("link", { name: "Daily exercise" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await dialog.getByRole("link", { name: "Pricing" }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("link", { name: "Pricing" })).toBeVisible();
});

for (const [path, current] of [
  ["/exercises/", "Exercises"],
  ["/exercises/tracks/", "Learning tracks"],
  ["/exercises/tracks/counting/", "Learning tracks"],
  ["/exercises/drills/", "Function drills"],
  ["/daily/", "Daily exercise"],
  ["/mock-assessments/", "Mock assessments"],
  ["/progress/", "Progress"],
] as const) {
  test(`the Practice tabs mark ${current} on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    const tabs = page.getByRole("navigation", { name: "Practice" });
    await expect(tabs.getByRole("link")).toHaveText(PRACTICE_NAV.map((i) => i.label));
    await expect(tabs.locator("a[aria-current]")).toHaveText(current);
    await expect(practiceButton(page)).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("the header keeps one row from 320 to 1920 px", async ({ page }) => {
  await page.goto("/exercises/");
  for (const width of [320, 375, 768, 800, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    const height = await page.locator(".site-header .bar").evaluate((e) => e.clientHeight);
    expect(height, `${width}`).toBe(width < 768 ? 56 : 64);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${width}`).toBeLessThanOrEqual(0);
  }
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe with a panel open and on the phone menu (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/daily/");
    await practiceButton(page).click();
    await expect(panel(page, "practice")).toBeVisible();
    const wide = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    const phone = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    for (const { violations } of [wide, phone]) {
      expect(
        violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
      ).toEqual([]);
    }
  });
}
