// Why this exists: points and the scoreboard. Home lists the board from
// /api/scoreboard/ with the learner's own row and level, and says how to join;
// a signed-in solve is sent to /api/solves/ and the page says what it earned.
import { expect, type Page, test } from "@playwright/test";

const level = (n: number, title: string, floor: number, next: number | null) => ({
  level: n,
  title,
  floor,
  next,
});
const TOP = [
  { rank: 1, nickname: "anna_k", points: 120, level: level(4, "Learner", 400, 600) },
  { rank: 2, nickname: "sheetwizard", points: 80, level: level(2, "Beginner", 100, 220) },
];

async function signIn(page: Page, nickname: string | null) {
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
        nickname,
      },
    }),
  );
  await page.route("**/api/progress/", (r) => r.fulfill({ json: {} }));
  await page.route("**/api/daily/", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/events/", (r) => r.fulfill({ status: 204 }));
}

test("signed out, Home shows the board and asks to sign up", async ({ page }) => {
  await page.route("**/api/scoreboard/**", (r) =>
    r.fulfill({ json: { period: "week", top: TOP, me: null } }),
  );
  await page.goto("/home/");
  const rows = page.locator("[data-board-rows] tr");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("anna_k");
  await expect(rows.first()).toContainText("Level 4, Learner");
  await expect(page.locator("[data-board-me]")).toBeHidden();
  await expect(page.locator("[data-board-note]")).toContainText(
    "Create a free account to earn points",
  );
});

test("signed in without a nickname, Home shows the own row and level, and the period switch", async ({
  page,
}) => {
  await signIn(page, null);
  const periods: string[] = [];
  await page.route("**/api/scoreboard/**", (r) => {
    const period = new URL(r.request().url()).searchParams.get("period") ?? "";
    periods.push(period);
    return r.fulfill({
      json: {
        period,
        top: period === "all" ? TOP : TOP.slice(0, 1),
        me: {
          nickname: null,
          rank: 14,
          points: 40,
          total: 150,
          level: level(2, "Beginner", 100, 220),
        },
      },
    });
  });
  await page.goto("/home/");
  const me = page.locator("[data-board-me]");
  await expect(me).toBeVisible();
  await expect(me).toContainText("Level 2, Beginner");
  await expect(page.locator("[data-board-note]")).toContainText("Choose a nickname");
  await page.getByRole("button", { name: "All time" }).click();
  await expect(page.locator("[data-board-rows] tr")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "All time" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(periods).toEqual(["week", "all"]);
});

test("a learner in the list is shown once, marked as You, with medals", async ({ page }) => {
  await signIn(page, "sheetwizard");
  await page.route("**/api/scoreboard/**", (r) =>
    r.fulfill({
      json: {
        period: "week",
        top: TOP,
        me: {
          nickname: "sheetwizard",
          rank: 2,
          points: 80,
          total: 150,
          level: level(2, "Beginner", 100, 220),
        },
      },
    }),
  );
  await page.goto("/home/");
  const mine = page.locator("[data-board-rows] tr.h-you");
  await expect(mine).toContainText("You");
  await expect(mine.locator(".h-medal")).toHaveAttribute("data-rank", "2");
  await expect(page.locator("[data-board-me]")).toBeHidden();
});

test("below sixth place the board stays six rows, the learner's last", async ({ page }) => {
  await signIn(page, "late_learner");
  const top = Array.from({ length: 6 }, (_, i) => ({
    rank: i + 1,
    nickname: `learner_${i + 1}`,
    points: 100 - i * 5,
    level: level(2, "Beginner", 100, 220),
  }));
  const me = { nickname: "late_learner", rank: 7, points: 5, total: 150 };
  await page.route("**/api/scoreboard/**", (r) =>
    r.fulfill({
      json: { period: "week", top, me: { ...me, level: level(2, "Beginner", 100, 220) } },
    }),
  );
  await page.goto("/home/");
  await expect(page.locator("[data-board-rows] tr")).toHaveCount(5);
  await expect(page.locator("[data-board] tbody tr:not(.h-gap):visible")).toHaveCount(6);
  await expect(page.locator("[data-board] tbody tr:not(.h-gap):visible").last()).toContainText(
    "You",
  );
  await expect(page.locator("[data-board-me] .h-medal")).toHaveText("7");
});

test("a signed-in solve is sent for points and says what it earned", async ({ page }) => {
  await signIn(page, "anna_k");
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/solves/", (r) => {
    sent = r.request().postDataJSON() as Record<string, unknown>;
    return r.fulfill({
      status: 201,
      json: {
        earned: [{ kind: "solve", points: 10 }],
        total: 10,
        level: level(1, "Beginner", 0, 100),
      },
    });
  });
  await page.goto("/exercises/add-two-cells/");
  await page.locator("[data-exercise] [data-input]").first().fill("=B2+B3");
  await page.locator("[data-exercise] [data-check]").first().click();
  await expect(page.locator("[data-points-earned]")).toHaveText(
    " You earned 10 points and are on level 1, Beginner.",
  );
  expect(sent).toMatchObject({ id: "add-two-cells", formulas: ["=B2+B3"], helped: false });
});
