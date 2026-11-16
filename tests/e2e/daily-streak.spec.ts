// Why this exists: the daily streak outside /daily/. The account page shows
// it joined with the account's days, the home page shows one quiet line only
// when there is a streak (and nothing moves when it does), and days solved
// signed out reach the account once, from the first page after sign-in.
import { readdirSync, readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { parse } from "yaml";
import { topicNumbers } from "../../src/lib/access.ts";
import { dailyPool, pickFor } from "../../src/lib/daily.ts";

const files = readdirSync("content/exercises").map(
  (f) =>
    parse(readFileSync(`content/exercises/${f}`, "utf8")) as {
      id: string;
      slug: string;
      topic: string;
    },
);
const order = (parse(readFileSync("content/track.yaml", "utf8")) as { order: string[] }).order;
const topicOf = new Map(files.map((e) => [e.id, e.topic]));
const numbers = topicNumbers(order, (id) => topicOf.get(id) ?? "");
const pool = dailyPool(
  files.map((e) => ({
    exercise: { id: e.id, slug: e.slug },
    topicNumber: numbers.get(e.id) ?? 0,
  })),
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

test("the account page shows the streak joined with the account's days", async ({ page }) => {
  await setDay(page, TODAY);
  await page.goto("/account/");
  await seed(page, ["2026-11-18", "2026-11-19", TODAY]);
  await signIn(page);
  const posts = await account(page, [solve("2026-11-17"), solve("2026-11-18")]);
  await page.reload();
  const card = page.locator("[data-streak]");
  await expect(card.getByRole("heading", { name: "Daily streak" })).toBeVisible();
  await expect(card.locator("[data-current]")).toHaveText("4 days");
  await expect(card.locator("[data-best]")).toHaveText("4 days");
  await expect(card.locator(".d-day.is-solved")).toHaveCount(4);
  await expect(card.locator(".d-day.is-today")).toHaveClass(/\bis-solved\b/u);
  await expect(card.getByRole("link", { name: "Open the daily exercise" })).toHaveAttribute(
    "href",
    "/daily/",
  );
  // Only the days the account lacked are sent, once.
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toEqual([solve("2026-11-19"), solve(TODAY)]);
  await page.reload();
  await expect(card.locator("[data-current]")).toHaveText("4 days");
  await page.waitForLoadState("networkidle");
  expect(posts).toHaveLength(1);
  await axe(page, "[data-strip] .d-day.is-solved >> nth=3");
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

for (const width of [375, 1280]) {
  test(`the home line shows a streak only when there is one, without moving the page (${width})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setDay(page, TODAY);
    await page.goto("/");
    const line = page.locator("[data-home-streak]");
    const boxes = () =>
      page.evaluate(() =>
        [".hero-try", ".stats", ".hero-actions"].map((s) => {
          const r = document.querySelector(s)?.getBoundingClientRect();
          return r ? [r.top, r.left, r.width, r.height] : null;
        }),
      );
    await expect(line).toBeHidden();
    await expect(page.locator(".hero-daily")).toHaveText("New every day: the daily exercise.");
    const before = await boxes();

    // A missed day before today: no current streak, so still nothing.
    await seed(page, ["2026-11-17", "2026-11-18"]);
    await page.reload();
    await expect(line).toBeHidden();

    await seed(page, ["2026-11-18", "2026-11-19", TODAY]);
    await page.reload();
    await expect(line).toHaveText("Your streak: 3 days.");
    expect(await boxes()).toEqual(before);
    // The line sits in the gap above the exercise, never over it.
    const lineBox = await line.boundingBox();
    const tryBox = await page.locator(".hero-try").boundingBox();
    if (width < 900 && lineBox && tryBox)
      expect(lineBox.y + lineBox.height).toBeLessThanOrEqual(tryBox.y);
    await axe(page, "[data-home-streak]");
  });
}
