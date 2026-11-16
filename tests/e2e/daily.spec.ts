// Why this exists: the daily exercise end to end in the built site. A solve
// counts toward the streak on its day, a missed day resets it quietly, an
// earlier day is practice only, a signed-in solve is posted once, a PRO
// exercise is never the daily, and the page works from the keyboard alone.
import { readdirSync, readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { parse } from "yaml";
import { topicNumbers } from "../../src/lib/access.ts";
import { DAILY_START, dailyPool, pickFor } from "../../src/lib/daily.ts";
import { addDays } from "../../src/scripts/progress.ts";

interface ExerciseFile {
  id: string;
  slug: string;
  topic: string;
  screens: { answer: string }[];
}
const files = readdirSync("content/exercises").map(
  (f) => parse(readFileSync(`content/exercises/${f}`, "utf8")) as ExerciseFile,
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

// The static test server has no Supabase, so the answers API is answered here
// as the live one answers on a Saturday: with the PRO daily's answers.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/exercises/*/**", (r) => {
    const slug = new URL(r.request().url()).pathname.split("/")[3];
    r.fulfill({
      json: { answers: files.find((e) => e.slug === slug)?.screens.map((s) => s.answer) },
    });
  });
});

/** Noon local time, so no time zone puts the day on either side of midnight. */
const setDay = (page: Page, day: string) => page.clock.setFixedTime(new Date(`${day}T12:00:00`));
const exerciseData = async (page: Page) =>
  JSON.parse(
    (await page.locator("[data-task-slot] script[data-exercise-data]").textContent()) ?? "{}",
  ) as { id: string; screens: { answer: string }[] };

/** Types each screen's answer and checks it, as a visitor would. */
async function solve(page: Page) {
  await expect(page.locator("[data-task-slot]")).toBeVisible();
  // A Saturday's PRO daily has no answers in the page; they come from the file.
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
  await setDay(page, "2026-11-20");
  await page.goto("/daily/");
  await solve(page);
  await setDay(page, "2026-11-21");
  await page.reload();
  await solve(page);
  await expect(stat(page, "current")).toHaveText("2 days");
  // The 22nd is missed.
  await setDay(page, "2026-11-23");
  await page.reload();
  await expect(page.locator("[data-state]")).toHaveText("Not solved yet today.");
  await expect(stat(page, "current")).toHaveText("0 days");
  await expect(stat(page, "best")).toHaveText("2 days");
  const solved = page.locator(".d-day.is-solved");
  await expect(solved).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Sunday 22 November, not solved" })).toBeVisible();
  await solve(page);
  await expect(stat(page, "current")).toHaveText("1 day");
  await expect(stat(page, "best")).toHaveText("2 days");
});

test("an earlier day can be played but does not count", async ({ page }) => {
  await setDay(page, "2026-11-20");
  await page.goto("/daily/");
  await page.getByRole("link", { name: "Thursday 19 November, not solved" }).click();
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

test("a PRO exercise is the daily on Saturdays only", async ({ page }) => {
  const proIds = pool.filter((e) => e.pro).map((e) => e.id);
  expect(proIds.length).toBeGreaterThan(0);
  await page.goto("/daily/");
  const pagePool = JSON.parse(
    (await page.locator("script[data-daily-pool]").textContent()) ?? "[]",
  ) as { id: string }[];
  expect(pagePool).toEqual(pool);
  for (let i = 0; i < 14; i++) {
    const day = addDays(DAILY_START, i);
    await setDay(page, day);
    await page.reload();
    await expect(page.locator("[data-task-slot]")).toBeVisible();
    const { id } = await exerciseData(page);
    expect(id).toBe(pickFor(day, pool)?.id);
    expect(proIds.includes(id)).toBe(new Date(`${day}T00:00:00Z`).getUTCDay() === 6);
  }
});

test("Saturday's PRO daily opens with the answers the API gives", async ({ page }) => {
  const day = "2026-11-21";
  const pick = pickFor(day, pool);
  expect(pick?.pro).toBe(true);
  await page.route(`**/api/exercises/${pick?.slug}/**`, (r) =>
    r.fulfill({ json: { answers: ["=1"] } }),
  );
  await setDay(page, day);
  await page.goto("/daily/");
  const exercise = page.locator("[data-task-slot] [data-exercise]");
  await expect(exercise).not.toHaveAttribute("data-locked");
  await expect(page.locator("[data-live-heading]")).toHaveText(
    "Today's exercise: a PRO one, free today",
  );
});

test("a past Saturday's PRO daily asks for PRO when the API says no", async ({ page }) => {
  const day = "2026-11-21";
  const pick = pickFor(day, pool);
  await page.route(`**/api/exercises/${pick?.slug}/**`, (r) =>
    r.fulfill({ status: 401, json: { error: "signed out" } }),
  );
  await setDay(page, "2026-11-23");
  await page.goto(`/daily/?day=${day}`);
  await expect(page.locator(".pro-note")).toContainText("Get PRO");
  await expect(page.locator("[data-task-slot] [data-exercise]")).toHaveAttribute("data-locked");
});

test("the daily works from the keyboard alone", async ({ page, browserName }) => {
  await setDay(page, "2026-11-20");
  await page.goto("/daily/");
  await expect(page.locator("[data-task-slot]")).toBeVisible();
  const { screens } = await exerciseData(page);
  // Tab through the page: the strip comes first, then the formula. Safari
  // skips links on Tab by default; Option+Tab reaches them, as a user would.
  const tab = browserName === "webkit" ? "Alt+Tab" : "Tab";
  let reachedStrip = false;
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press(tab);
    const at = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return {
        id: el?.id ?? "",
        strip: Boolean(el?.closest("[data-strip]")),
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
