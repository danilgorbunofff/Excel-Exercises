// Why this exists: the daily exercise end to end in the built site. The week
// climbs from the easiest task on Monday to the hardest on Sunday, a solve
// counts toward the streak on its day, a missed day resets it quietly, an
// earlier day is practice only, a signed-in solve is posted once, and the page
// works from the keyboard alone.
import { readdirSync, readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { parse } from "yaml";
import { LADDER_START, ladderPool, pickFor } from "../../src/lib/daily.ts";
import { addDays } from "../../src/scripts/progress.ts";

interface DailyFile {
  id: string;
  slug: string;
  tier: number;
  level: number;
  screens: { answer: string }[];
}
const files = readdirSync("content/daily").map(
  (f) => parse(readFileSync(`content/daily/${f}`, "utf8")) as DailyFile,
);
const pool = ladderPool(files);

/** Noon local time, so no time zone puts the day on either side of midnight. */
const setDay = (page: Page, day: string) => page.clock.setFixedTime(new Date(`${day}T12:00:00`));
const exerciseData = async (page: Page) =>
  JSON.parse(
    (await page.locator("[data-task-slot] script[data-exercise-data]").textContent()) ?? "{}",
  ) as { id: string; screens: { answer: string }[] };

/** Types each screen's answer and checks it, as a visitor would. */
async function solve(page: Page) {
  await expect(page.locator("[data-task-slot]")).toBeVisible();
  const { id } = await exerciseData(page);
  const screens = files.find((e) => e.id === id)?.screens ?? [];
  for (const [i, s] of screens.entries()) {
    const input = page.locator(i === 0 ? "#formula" : `#formula-${i + 1}`);
    await input.fill(s.answer);
    await input.press("Enter");
    if (i < screens.length - 1) await page.keyboard.press("Enter");
  }
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

const stat = (page: Page, name: "today" | "current" | "best") => page.locator(`[data-${name}]`);

test("a signed-out solve counts today and stays after a reload", async ({ page }) => {
  await setDay(page, "2026-11-20");
  await page.goto("/daily/");
  await expect(stat(page, "today")).toHaveText("Not yet");
  await expect(stat(page, "current")).toHaveText("0 days");
  expect((await exerciseData(page)).id).toBe(pickFor("2026-11-20", pool)?.id);
  await solve(page);
  await expect(page.locator("[data-state]")).toHaveText(
    "Solved today. A new exercise comes tomorrow.",
  );
  await expect(stat(page, "today")).toHaveText("Solved");
  await expect(stat(page, "current")).toHaveText("1 day");
  await expect(stat(page, "best")).toHaveText("1 day");
  await page.reload();
  await expect(stat(page, "current")).toHaveText("1 day");
  await expect(page.locator(".d-day.is-today")).toHaveClass(/\bis-solved\b/u);
  const stored = await page.evaluate(() => localStorage.getItem("formula-practice:daily:v1"));
  expect(JSON.parse(stored ?? "{}")).toEqual({ "2026-11-20": pickFor("2026-11-20", pool)?.id });
});

test("a missed day resets the streak and keeps the best", async ({ page }) => {
  await setDay(page, "2026-11-17");
  await page.goto("/daily/");
  await solve(page);
  await setDay(page, "2026-11-18");
  await page.reload();
  await solve(page);
  await expect(stat(page, "current")).toHaveText("2 days");
  // The 19th is missed.
  await setDay(page, "2026-11-20");
  await page.reload();
  await expect(page.locator("[data-state]")).toHaveText("Not solved yet today.");
  await expect(stat(page, "current")).toHaveText("0 days");
  await expect(stat(page, "best")).toHaveText("2 days");
  await expect(page.locator(".d-day.is-solved")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "Thursday 19 November, medium, not solved" }),
  ).toBeVisible();
  await solve(page);
  await expect(stat(page, "current")).toHaveText("1 day");
  await expect(stat(page, "best")).toHaveText("2 days");
});

test("an earlier day can be played but does not count", async ({ page }) => {
  await setDay(page, "2026-11-20");
  await page.goto("/daily/");
  await page.getByRole("link", { name: "Thursday 19 November, medium, not solved" }).click();
  await expect(page).toHaveURL(/\?day=2026-11-19$/u);
  await expect(page.locator("[data-live-heading]")).toHaveText(
    "The exercise for Thursday 19 November",
  );
  expect((await exerciseData(page)).id).toBe(pickFor("2026-11-19", pool)?.id);
  await solve(page);
  await expect(page.locator("[data-verdict]").first()).toContainText("Correct");
  await expect(stat(page, "current")).toHaveText("0 days");
  await expect(page.locator(".d-day.is-solved")).toHaveCount(0);
});

test("a signed-in solve is saved to the account once", async ({ page }) => {
  await setDay(page, "2026-11-20");
  await page.goto("/daily/");
  await signIn(page);
  const rows: { day: string; exercise: string }[] = [];
  const posts: unknown[] = [];
  await page.route("**/api/daily/", (r) => {
    if (r.request().method() === "GET") return r.fulfill({ json: rows });
    const body = r.request().postDataJSON() as typeof rows;
    posts.push(body);
    rows.push(...body);
    return r.fulfill({ status: 201, json: { saved: body.length } });
  });
  await page.reload();
  await expect(page.locator('[data-when="in"]').last()).toBeVisible();
  await solve(page);
  await expect(stat(page, "current")).toHaveText("1 day");
  await expect.poll(() => posts.length).toBe(1);
  await page.reload();
  await expect(stat(page, "current")).toHaveText("1 day");
  await page.waitForLoadState("networkidle");
  expect(posts).toEqual([[{ day: "2026-11-20", exercise: pickFor("2026-11-20", pool)?.id }]]);
});

test("the account's days are merged into this browser on sign in", async ({ page }) => {
  await setDay(page, "2026-11-20");
  await page.goto("/daily/");
  await signIn(page);
  const day = "2026-11-19";
  await page.route("**/api/daily/", (r) =>
    r.request().method() === "GET"
      ? r.fulfill({ json: [{ day, exercise: pickFor(day, pool)?.id }] })
      : r.fulfill({ status: 201, json: { saved: 1 } }),
  );
  await page.reload();
  await expect(stat(page, "current")).toHaveText("1 day");
  await expect(stat(page, "today")).toHaveText("Not yet");
});

test("the week climbs from Monday's easiest task to Sunday's hardest", async ({ page }) => {
  await page.goto("/daily/");
  const pagePool = JSON.parse(
    (await page.locator("script[data-daily-pool]").textContent()) ?? "[]",
  ) as unknown;
  expect(pagePool).toEqual(pool);
  const levels: number[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(LADDER_START, i);
    await setDay(page, day);
    await page.reload();
    await expect(page.locator("[data-task-slot]")).toBeVisible();
    const { id } = await exerciseData(page);
    const task = files.find((f) => f.id === id);
    expect(id).toBe(pickFor(day, pool)?.id);
    expect(task?.tier).toBe(i + 1);
    levels.push(task?.level ?? 0);
  }
  expect(levels).toEqual([...levels].sort());
  // On Sunday the calendar names each day of the week with its step.
  const steps = ["warm-up", "easy", "steady", "medium", "tricky", "hard", "hardest"];
  for (const [i, step] of steps.entries()) {
    await expect(page.locator(".d-day").nth(15 + i)).toContainText(`, ${step}, `);
  }
});

test("the calendar shows the month and days to come cannot be opened", async ({ page }) => {
  await setDay(page, "2026-11-18");
  await page.goto("/daily/");
  await expect(page.locator("[data-month-title]")).toHaveText("November 2026");
  await expect(page.locator(".d-day")).toHaveCount(30);
  await expect(page.locator(".d-day.is-future a")).toHaveCount(0);
  await expect(page.locator(".d-day.is-future")).toHaveCount(12);
  await expect(page.locator(".d-day.is-today")).toContainText("steady");
  // November 2026 starts on a Sunday, the last column.
  await expect(page.locator(".d-day").first()).toHaveCSS("grid-column-start", "7");
  await expect(page.locator("[data-month-prev]")).toBeDisabled();
  await expect(page.locator("[data-month-next]")).toBeDisabled();
});

test("the calendar pages back to earlier months", async ({ page }) => {
  await setDay(page, "2026-12-02");
  await page.goto("/daily/");
  await expect(page.locator("[data-month-title]")).toHaveText("December 2026");
  await page.locator("[data-month-prev]").click();
  await expect(page.locator("[data-month-title]")).toHaveText("November 2026");
  await expect(page.locator(".d-day.is-future")).toHaveCount(0);
  await expect(page.locator("[data-month-prev]")).toBeDisabled();
  await page.locator("[data-month-next]").click();
  await expect(page.locator("[data-month-title]")).toHaveText("December 2026");
});

test("at phone width the calendar fits without scrolling sideways", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setDay(page, "2026-11-18");
  await page.goto("/daily/");
  await expect(page.locator(".d-day")).toHaveCount(30);
  const widths = await page
    .locator(".d-month .d-cell")
    .evaluateAll((cells) => cells.map((c) => Math.round(c.getBoundingClientRect().width)));
  expect(new Set(widths).size).toBe(1);
  expect(widths[0]).toBeGreaterThanOrEqual(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("the daily works from the keyboard alone", async ({ page, browserName }) => {
  await setDay(page, "2026-11-20");
  await page.goto("/daily/");
  await expect(page.locator("[data-task-slot]")).toBeVisible();
  const { screens } = await exerciseData(page);
  // Tab through the page: the calendar comes first, then the formula. Safari
  // skips links on Tab by default; Option+Tab reaches them, as a user would.
  const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
  let reachedStrip = false;
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press(tab);
    const at = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return {
        id: el?.id ?? "",
        strip: Boolean(el?.closest("[data-month]")),
        outline: el ? getComputedStyle(el).outlineStyle : "none",
      };
    });
    if (at.strip) {
      reachedStrip = true;
      expect(at.outline).not.toBe("none");
    }
    if (at.id === "formula") break;
  }
  expect(reachedStrip).toBe(true);
  await expect(page.locator("#formula")).toBeFocused();
  for (const [i, s] of screens.entries()) {
    await page.keyboard.type(s.answer);
    await page.keyboard.press("Enter");
    if (i < screens.length - 1) {
      await page.keyboard.press("Enter");
      await expect(page.locator(`#formula-${i + 2}`)).toBeFocused();
    }
  }
  await expect(page.locator("[data-state]")).toHaveText(
    "Solved today. A new exercise comes tomorrow.",
  );
  await expect(stat(page, "current")).toHaveText("1 day");
});
