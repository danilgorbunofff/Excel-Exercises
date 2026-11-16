// Why this exists: the exercise loop end to end, in the built site, on the
// three browser engines. A wrong answer is shown on the grid and in the
// formula, Check turns into Next, hints run in order, and the screen fits.
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { parse } from "yaml";
import { sitemapRoutes } from "./routes.ts";

const SUM = "/exercises/sum-a-column/";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const cell = (page: Page, address: string) => page.locator(`td[data-cell="${address}"]`);
const status = (page: Page) => page.locator("[data-status]").first();

async function check(page: Page, formula: string) {
  await page.locator("#formula").fill(formula);
  await page.locator("#formula").press("Enter");
}

test("a wrong range is outlined on the grid and marked in the formula", async ({ page }) => {
  await page.goto(SUM);
  await check(page, "=SUM(B2:B4)");
  await expect(status(page)).toContainText("Wrong result in B6.");
  await expect(status(page)).toContainText("Check that the range starts at B2 and ends at B5.");
  await expect(status(page)).toContainText("Your formula reads B2:B4 (3 cells, total 358)");
  await expect(cell(page, "B2")).toHaveClass(/\bread-top\b/u);
  await expect(cell(page, "B4")).toHaveClass(/\bread-bottom\b/u);
  await expect(cell(page, "B5")).not.toHaveClass(/\bread\b/u);
  await expect(cell(page, "B6")).toHaveText("358");
  await expect(cell(page, "B6")).toHaveClass(/answer-miss/u);
  await expect(page.locator("#formula")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("[data-mirror] mark.read")).toHaveText("B2:B4");
});

test("a syntax error marks the part of the formula it is about", async ({ page }) => {
  await page.goto(SUM);
  await check(page, "=SUM(B2:B5");
  await expect(status(page)).toContainText("Formula error in B6.");
  await expect(status(page)).toContainText("Add ) to close SUM(.");
  await expect(page.locator("[data-mirror] mark.miss")).toHaveCount(1);
});

test("an empty formula asks for one", async ({ page }) => {
  await page.goto(SUM);
  await page.getByRole("button", { name: "Check" }).click();
  await expect(status(page)).toContainText("Type a formula first.");
});

test("a correct answer turns Check into Next, in track order, and is remembered", async ({
  page,
}) => {
  await page.goto(SUM);
  await check(page, "=sum(b2:b5)");
  await expect(status(page)).toContainText("Correct. B6 shows 446.");
  // The completion dialog opens with the next exercise focused.
  const dialog = page.getByRole("dialog", { name: "Exercise completed" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Next recommended exercise: Average score" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  const next = page.getByRole("link", { name: "Next: Average score" });
  await expect(next).toBeVisible();
  await expect(next).toBeFocused();
  await expect(next).toHaveAttribute("href", "/exercises/average-score/");
  await expect(page.getByRole("button", { name: "Check" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Show a hint" })).toBeHidden();
  await expect(page.locator("[data-progress]")).toHaveText("You solved this exercise.");

  // A changed formula has not been checked: Check is the action again.
  await page.locator("#formula").fill("=SUM(B2:B5)+1");
  await expect(page.getByRole("button", { name: "Check" })).toBeVisible();
  await expect(next).toBeHidden();

  await page.reload();
  await expect(page.locator("[data-progress]")).toHaveText("You solved this exercise.");
});

test("Reset clears the formula, the grid and the verdict", async ({ page }) => {
  await page.goto(SUM);
  const reset = page.getByRole("button", { name: "Reset" });
  await expect(reset).toBeDisabled();
  await check(page, "=SUM(B2:B4)");
  await reset.click();
  await expect(page.locator("#formula")).toHaveValue("");
  await expect(page.locator("#formula")).toBeFocused();
  await expect(cell(page, "B2")).not.toHaveClass(/\bread\b/u);
  await expect(cell(page, "B6")).toHaveText("");
  await expect(status(page)).toContainText("Type a formula for B6");
});

test("hints open in order, compare ranges, and the answer marks the solve as helped", async ({
  page,
}) => {
  await page.goto(SUM);
  await check(page, "=SUM(B2:B4)");
  const more = page.getByRole("button", { name: "Show a hint" });
  await more.click();
  await expect(page.locator('details[data-hint="1"]')).toHaveAttribute("open", "");
  await more.click();
  await expect(page.locator("[data-compare]")).toHaveText(
    "Compared with the answer, your formula leaves out B5.",
  );
  await more.click();
  await expect(page.locator('details[data-hint="3"]')).toContainText("=SUM(B2:B5)");
  await expect(more).toBeHidden();
  await expect(page.locator("[data-progress]")).toHaveText(
    "You have seen the answer to this exercise.",
  );
  await check(page, "=SUM(B2:B5)");
  await expect(page.locator("[data-progress]")).toHaveText("You solved this exercise with help.");
});

test("the skip link reaches the formula with one Tab and Enter", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "Safari skips links on Tab unless the user turns it on.");
  await page.goto(SUM);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to the formula" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#formula")).toBeFocused();
});

test("without JavaScript the task, sheet and hints are all there", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: baseURL ?? "" });
  const page = await context.newPage();
  await page.goto(SUM);
  await expect(page.locator(".prompt").first()).toContainText("In B6, add up the sales");
  await expect(cell(page, "B2")).toHaveText("120");
  await expect(page.locator("#formula")).toBeVisible();
  // Playwright's text search skips <noscript>, so the paragraph is found by its class.
  await expect(page.locator("p.noscript").first()).toContainText(
    "Checking a formula needs JavaScript.",
  );
  await expect(page.locator("p.noscript").first()).toBeVisible();
  await expect(page.locator('details[data-hint="1"]')).toBeVisible();
  await context.close();
});

test("on a phone, the task, input, grid and verdict fit on one screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(SUM);
  await check(page, "=SUM(B2:B4)");
  const box = await status(page).boundingBox();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(812);
  await expect(page.locator(".prompt").first()).toBeInViewport();
  await expect(page.locator("#formula")).toBeInViewport();
});

test("at 320 px nothing scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const route of ["/exercises/free-delivery/", "/exercises/find-an-extension/", SUM]) {
    await page.goto(route);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, route).toBeLessThanOrEqual(0);
  }
});

test("the menu opens as a dialog on a phone and closes again", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(SUM);
  await page.getByRole("button", { name: "Menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Exercises" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

for (const colorScheme of ["light", "dark"] as const) {
  for (const [state, formula] of [
    ["wrong", "=SUM(B2:B4)"],
    ["correct", "=SUM(B2:B5)"],
  ] as const) {
    test(`axe: exercise in the ${state} state (${colorScheme})`, async ({ page }) => {
      // Reduced motion turns off the 150 to 180 ms colour fades, so axe reads
      // the resting colours, not a colour halfway through a transition.
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(SUM);
      await check(page, formula);
      await page.getByRole("button", { name: "Show a hint" }).isVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const blocking = violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
      expect(blocking).toEqual([]);
    });
  }
}

const exerciseRoutes = sitemapRoutes().filter(
  (r) => /^\/exercises\/[^/]+\/$/u.test(r) && r !== "/exercises/tracks/",
);

test("every exercise in the track has a page", () => {
  expect(exerciseRoutes).toHaveLength(112);
});

/**
 * Opens a PRO exercise as a visitor with PRO would see it. The static test
 * server has no /api/, so the two answers the page asks for are faked here,
 * from the exercise file.
 */
async function openAsPro(page: Page, route: string): Promise<void> {
  const slug = route.split("/")[2] ?? "";
  const file = parse(readFileSync(`content/exercises/${slug}.yaml`, "utf8")) as {
    screens: { answer: string }[];
  };
  await page.context().addCookies([{ name: "signed_in", value: "1", url: page.url() }]);
  await page.route("**/api/me/", (r) =>
    r.fulfill({
      json: {
        email: "pro@example.com",
        pro: true,
        proStatus: "active",
        proUntil: null,
        news: false,
        hasPassword: true,
      },
    }),
  );
  await page.route("**/api/progress/", (r) => r.fulfill({ json: {} }));
  await page.route(`**/api/exercises/${slug}/`, (r) =>
    r.fulfill({ json: { answers: file.screens.map((s) => s.answer) } }),
  );
  await page.reload();
  await expect(page.locator("[data-paywall]")).toHaveCount(0);
}

// One test per exercise, so they run in parallel and a failure names the page.
for (const route of exerciseRoutes) {
  test(`${route} accepts its own reference answer in the browser`, async ({ page }) => {
    await page.goto(route);
    if ((await page.locator("[data-locked]").count()) > 0) await openAsPro(page, route);
    const answer = await page.locator('details[data-hint="3"] code').first().textContent();
    await check(page, answer ?? "");
    await expect(status(page)).toContainText("Correct.");
    await expect(page.locator("[data-next]").first()).toBeVisible();
  });
}

test("the last exercise leads to all exercises", async ({ page }) => {
  const last = "/exercises/clean-a-product-code-then-look-it-up/";
  const { screens } = parse(
    readFileSync("content/exercises/clean-a-product-code-then-look-it-up.yaml", "utf8"),
  ) as { screens: { answer: string }[] };
  await page.goto(last);
  await openAsPro(page, last);
  for (const [i, s] of screens.entries()) {
    const input = page.locator(i === 0 ? "#formula" : `#formula-${i + 1}`);
    await input.fill(s.answer);
    await input.press("Enter");
    if (i < screens.length - 1) await page.keyboard.press("Enter");
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "All exercises", exact: true })).toHaveAttribute(
    "href",
    "/exercises/",
  );
});

test("the Answer tab shows the answer and counts as seeing it", async ({ page }) => {
  await page.goto(SUM);
  const answerTab = page.getByRole("tab", { name: "Answer" });
  await answerTab.click();
  await expect(answerTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Answer" })).toContainText("=SUM(B2:B5)");
  await expect(page.locator("[data-progress]")).toHaveText(
    "You have seen the answer to this exercise.",
  );
  await answerTab.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Exercise" })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Exercise" })).toBeVisible();
});

test("the timer starts on typing, stops on the right answer and can be hidden", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(SUM);
  const time = page.getByRole("timer");
  await expect(time).toHaveText("00:00:00");
  await page.locator("#formula").fill("=SUM(B2:B5)");
  await page.clock.runFor(3000);
  await expect(time).toHaveText("00:00:03");
  await page.locator("#formula").press("Enter");
  await page.clock.runFor(5000);
  await expect(time).toHaveText("00:00:03");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Hide the timer" }).click();
  await expect(page.getByRole("button", { name: "Show the timer" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the panel divider moves with the keyboard and remembers the width", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(SUM);
  const divider = page.getByRole("separator", { name: "Resize the task and sheet panels" });
  await expect(divider).toHaveAttribute("aria-valuenow", "40");
  await divider.focus();
  await divider.press("ArrowRight");
  await divider.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "44");
  await divider.press("End");
  await expect(divider).toHaveAttribute("aria-valuenow", "65");
  await page.reload();
  await expect(divider).toHaveAttribute("aria-valuenow", "65");
});
