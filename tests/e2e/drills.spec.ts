// Why this exists: function drills are PRO. With PRO a session plays the chosen
// drills in a row and ends on a summary; without it the first drill is a
// locked preview under the paywall. A wrong check puts the drill on the
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

const formula = (page: Page) => page.locator("[data-drill-slot] [data-input]");
const check = (page: Page) => page.locator("[data-drill-slot] [data-check]");
const next = (page: Page) => page.locator("[data-drill-slot] [data-next]");

test("with PRO, chosen drills play in a row and end on a summary", async ({ page }) => {
  await signIn(page, true);
  await page.goto("/exercises/drills/?id=sum-drill-1");
  await expect(page.locator("[data-session-title]")).toHaveText("Task 1 of 1: SUM");
  await expect(page.locator("[data-paywall]")).toBeHidden();
  await formula(page).fill("=SUM(B2:B5)");
  await check(page).click();
  await formula(page).fill(answerOf("sum-drill-1"));
  await check(page).click();
  await expect(next(page)).toHaveText("See your results");
  await next(page).click();
  await expect(page.locator("[data-summary-line]")).toHaveText("You solved 1 of 1 task.");
  await expect(page.locator("[data-missed-list]")).toContainText("Practise SUM again");

  // Missed and solved on the same day: it comes back with the normal review gap, not at once.
  await page.goto("/progress/");
  await expect(page.locator("[data-review]")).toBeHidden();

  await page.goto("/exercises/drills/?fn=MAX&fn=MIN");
  await expect(page.locator("[data-session-title]")).toHaveText("Task 1 of 10: MAX");
  await page.locator("[data-skip]").click();
  await expect(page.locator("[data-session-title]")).toHaveText("Task 2 of 10: MAX");
  await page.locator("[data-finish]").click();
  await expect(page.locator("[data-summary-line]")).toHaveText("You solved 0 of 2 tasks.");
});

test("without PRO, the first drill is a locked preview under the paywall", async ({ page }) => {
  await signIn(page, false);
  await page.goto("/exercises/drills/?fn=AVERAGE");
  await expect(page.locator("[data-paywall]")).toBeVisible();
  await expect(page.locator("[data-paywall-text]")).toContainText(
    "Function practice is part of PRO",
  );
  await expect(page.locator("[data-drill-slot] .work").first()).toHaveJSProperty("inert", true);
  await expect(page.locator("[data-skip]")).toBeHidden();
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
  await expect(page.locator("[data-review]")).toContainText("Not solved yet, 1 wrong check");
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
  await page.locator(".pick:has(input[value=SUM])").click();
  await page.locator(".pick:has(input[value=IF])").click();
  await expect(set).toHaveText("from 2 functions");
  await expect(page.locator("[data-start]")).toHaveText("Start 10 tasks");
  await page.locator("[data-start]").click();
  await expect(page).toHaveURL(/\?fn=SUM&fn=IF$/u);
});
