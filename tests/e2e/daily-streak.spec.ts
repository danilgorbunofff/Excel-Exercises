// Why this exists: the daily streak outside /daily/. The account page shows
// it joined with the account's days, and days solved signed out reach the
// account once, from the first page after sign-in.
import { readdirSync, readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { parse } from "yaml";
import { ladderPool, pickFor } from "../../src/lib/daily.ts";

const pool = ladderPool(
  readdirSync("content/daily").map(
    (f) =>
      parse(readFileSync(`content/daily/${f}`, "utf8")) as {
        id: string;
        slug: string;
        tier: number;
      },
  ),
);
const solve = (day: string) => ({ day, exercise: pickFor(day, pool)?.id ?? "" });
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const TODAY = "2026-11-20";

const setDay = (page: Page, day: string) => page.clock.setFixedTime(new Date(`${day}T12:00:00`));

/** Puts solved days in this browser, as /daily/ would have. */
async function seed(page: Page, days: string[]) {
  await page.evaluate(
    (entries) => localStorage.setItem("formula-practice:daily:v1", JSON.stringify(entries)),
    Object.fromEntries(days.map((d) => [d, solve(d).exercise])),
  );
}

async function signIn(page: Page) {
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
}

/** A fake /api/daily/ that keeps what is posted, like the insert-only table. */
async function account(page: Page, rows: { day: string; exercise: string }[]) {
  const posts: { day: string; exercise: string }[][] = [];
  await page.route("**/api/daily/", (r) => {
    if (r.request().method() === "GET") return r.fulfill({ json: rows });
    const body = r.request().postDataJSON() as typeof rows;
    posts.push(body);
    for (const s of body) if (!rows.some((x) => x.day === s.day)) rows.push(s);
    return r.fulfill({ status: 201, json: { saved: body.length } });
  });
  return posts;
}

/** axe in both schemes. Each scheme loads fresh, so no colour transition is caught midway. */
async function axe(page: Page, ready: string) {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.reload();
    await expect(page.locator(ready)).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(
      violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  }
}

test("the account daily page shows the streak joined with the account's days", async ({ page }) => {
  await setDay(page, TODAY);
  await page.goto("/account/daily/");
  await seed(page, ["2026-11-18", "2026-11-19", TODAY]);
  await signIn(page);
  const posts = await account(page, [solve("2026-11-17"), solve("2026-11-18")]);
  await page.reload();
  await expect(page.locator("[data-fig=streak]")).toHaveText("4");
  await expect(page.locator("[data-fig=best]")).toHaveText("4");
  const card = page.locator("[data-daily-cal]");
  await expect(card.locator(".d-day.is-solved")).toHaveCount(4);
  await expect(card.locator(".d-day.is-today")).toHaveClass(/\bis-solved\b/u);
  await expect(page.locator("[data-today-state]")).toHaveText("Solved today");
  await expect(page.getByRole("link", { name: "Open today's exercise" })).toHaveAttribute(
    "href",
    "/daily/",
  );
  // Only the days the account lacked are sent, once.
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toEqual([solve("2026-11-19"), solve(TODAY)]);
  await page.reload();
  await expect(page.locator("[data-fig=streak]")).toHaveText("4");
  await page.waitForLoadState("networkidle");
  expect(posts).toHaveLength(1);
  await axe(page, "[data-daily-cal] .d-day.is-solved >> nth=3");
});

test("days solved signed out reach the account from the first page after sign-in", async ({
  page,
}) => {
  await setDay(page, TODAY);
  await page.goto("/");
  await seed(page, ["2026-11-19", TODAY]);
  await signIn(page);
  const posts = await account(page, []);
  await page.reload();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toEqual([solve("2026-11-19"), solve(TODAY)]);
  await page.goto("/exercises/");
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(posts).toHaveLength(1);
});
