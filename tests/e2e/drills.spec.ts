// Why this exists: function drills are PRO. With PRO a session opens the chosen
// drills as exercise pages, with Previous and Next, and ends on a summary;
// without it each drill is a locked preview under the paywall. A wrong check puts the drill on the
// progress page's review list.
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { parse } from "yaml";

const answerOf = (id: string) =>
  (parse(readFileSync(`content/drills/${id}.yaml`, "utf8")) as { screens: { answer: string }[] })
    .screens[0]?.answer ?? "";

async function signIn(page: Page, pro: boolean) {
  await page.goto("/");
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
  await page.route("**/api/events/", (r) => r.fulfill({ status: 204 }));
  await page.route("**/api/exercises/*/", (r) => {
    const slug = new URL(r.request().url()).pathname.split("/").at(-2) ?? "";
    return pro
      ? r.fulfill({ json: { answers: [answerOf(slug)] } })
      : r.fulfill({ status: 403, json: { error: "PRO needed" } });
  });
}

const formula = (page: Page) => page.locator("[data-exercise] [data-input]").first();
const check = (page: Page) => page.locator("[data-exercise] [data-check]").first();
const title = (page: Page) => page.locator("[data-session-title]");

test("with PRO, chosen drills open as exercise pages and end on a summary", async ({ page }) => {
  await signIn(page, true);
  await page.goto("/exercises/drills/?id=sum-drill-1");
  await expect(page).toHaveURL(/\/exercises\/drills\/sum-drill-1\/$/u);
  await expect(title(page)).toHaveText("Task 1 of 1");
  await expect(page.locator("[data-paywall]")).toHaveCount(0);
  await expect(page.locator("[data-tabs]")).toBeVisible();
  await formula(page).fill("=SUM(B2:B5)");
  await check(page).click();
  await formula(page).fill(answerOf("sum-drill-1"));
  await check(page).click();
  const done = page.locator("[data-done-next]");
  await expect(done).toContainText("See your results");
  await done.click();
  await expect(page.locator("[data-summary-line]")).toHaveText("You solved 1 of 1 task.");
  await expect(page.locator("[data-missed-list]")).toContainText("Practise SUM again");

  // Missed and solved on the same day: it comes back with the normal review gap, not at once.
  await page.goto("/progress/");
  await expect(page.locator("[data-review]")).toBeHidden();

  await page.goto("/exercises/drills/?fn=MAX&fn=MIN");
  await expect(title(page)).toHaveText("Task 1 of 10");
  await expect(page.locator("[data-session-prev]")).toHaveAttribute("aria-disabled", "true");
  await page.locator("[data-session-next]").click();
  await expect(title(page)).toHaveText("Task 2 of 10");
  await page.locator("[data-session-prev]").click();
  await expect(title(page)).toHaveText("Task 1 of 10");
  await page.locator("[data-session-finish]").click();
  await expect(page.locator("[data-summary-line]")).toHaveText("You solved 0 of 2 tasks.");
});

test("without PRO, each drill is a locked preview under the paywall", async ({ page }) => {
  await signIn(page, false);
  await page.goto("/exercises/drills/?fn=AVERAGE");
  await expect(page.locator("[data-paywall]")).toBeVisible();
  await expect(page.locator("#paywall-title")).toHaveText("Practise every function with PRO");
  await expect(page.locator(".work:not(.paywall)").first()).toHaveJSProperty("inert", true);
  await page.locator("[data-session-next]").click();
  await expect(title(page)).toHaveText("Task 2 of 5");
  await expect(page.locator("[data-paywall]")).toBeVisible();
});

test("a wrong check on an unsolved drill puts it on the review list", async ({ page }) => {
  await signIn(page, true);
  await page.goto("/exercises/drills/?id=min-drill-1");
  await formula(page).fill("=MIN(B2:B3)");
  await check(page).click();
  await page.goto("/progress/");
  await expect(page.locator("[data-review]")).toContainText(
    "MIN practice: Find the cheapest quote",
  );
  await expect(page.locator("[data-review] [data-why=unsolved]").first()).toHaveText(
    "Not solved yet",
  );
  await expect(page.locator("[data-review] .why-note").first()).toHaveText("1 wrong check");
});

test("the picker asks for a function before it starts", async ({ page }) => {
  await page.goto("/exercises/drills/");
  await page.locator("[data-start]").click();
  await expect(page).toHaveURL(/\/exercises\/drills\/$/u);
  await expect(page.locator("[data-pick-hint]")).toHaveAttribute("role", "alert");
});

test("the picker shows the chosen set and starts it", async ({ page }) => {
  await page.goto("/exercises/drills/");
  const set = page.locator("[data-set-count]");
  await expect(set).toHaveText("Tick one or more functions.");
  // One group shows at a time; the list on the left switches it and counts the picks.
  await expect(page.locator(".pick:has(input[value=IF])")).toBeHidden();
  await page.locator(".pick:has(input[value=SUM])").click();
  await page.getByRole("button", { name: /^Choose between results/u }).click();
  await expect(page.locator(".pick:has(input[value=SUM])")).toBeHidden();
  await page.locator(".pick:has(input[value=IF])").click();
  await expect(set).toHaveText("from 2 functions");
  await expect(page.getByRole("button", { name: /^Totals and averages/u })).toContainText(
    "1 picked",
  );
  // Typing in the filter searches every group.
  await page.locator("[data-filter]").fill("COUNTIF");
  await expect(page.locator(".pick:has(input[value=COUNTIFS])")).toBeVisible();
  await page.locator("[data-filter]").fill("");
  await expect(page.locator("[data-start]")).toHaveText("Start 10 tasks");
  await page.locator("[data-start]").click();
  await expect(page).toHaveURL(/\/exercises\/drills\/sum-drill-1\/$/u);
  await expect(title(page)).toHaveText("Task 1 of 10");
  // The session address is replaced, so Back returns to the picker.
  await page.goBack();
  await expect(page).toHaveURL(/\/exercises\/drills\/$/u);
});

test("a Free user runs 10 random tasks once a day", async ({ page }) => {
  await signIn(page, false);
  // The server keeps today's ten; only those drills' answers are given out.
  const run = ["sum", "if", "max", "min", "abs", "and", "average", "round", "left", "len"].map(
    (fn) => `${fn}-drill-1`,
  );
  await page.route("**/api/drills/free-run/", (r) =>
    r.fulfill({
      json: r.request().method() === "POST" ? { slugs: run } : { pro: false, today: run },
    }),
  );
  await page.route("**/api/exercises/*/", (r) => {
    const slug = new URL(r.request().url()).pathname.split("/").at(-2) ?? "";
    return run.includes(slug)
      ? r.fulfill({ json: { answers: [answerOf(slug)] } })
      : r.fulfill({ status: 403, json: { error: "PRO needed" } });
  });
  await page.goto("/exercises/drills/");
  await expect(page.locator("[data-random-label]")).toHaveText("Continue today's 10 tasks");
  await page.locator("button[name=fn][value=random]").click();
  await expect(page).toHaveURL(/\/exercises\/drills\/sum-drill-1\/$/u);
  await expect(title(page)).toHaveText("Task 1 of 10");
  await expect(page.locator("[data-paywall]")).toHaveCount(0);
  // Pressing again the same day resumes the same ten.
  await page.goto("/exercises/drills/");
  await page.locator("button[name=fn][value=random]").click();
  await expect(page).toHaveURL(/\/exercises\/drills\/sum-drill-1\/$/u);
  await expect(title(page)).toHaveText("Task 1 of 10");
  // A drill outside the run stays locked.
  await page.goto("/exercises/drills/?id=abs-drill-2");
  await expect(page.locator("[data-paywall]")).toBeVisible();
});
