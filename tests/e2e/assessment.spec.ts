// Why this exists: the mock assessment end to end in the built site. Nothing is
// marked until Finish, the clock ends the attempt, a reload keeps it, PRO sets
// stay locked without PRO, and a signed-in result is posted once.
import { existsSync, readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { parse } from "yaml";

const SAMPLE = "/mock-assessments/sample/";
const PRO_SET = "/mock-assessments/office-essentials/";

interface SetFile {
  sets: {
    slug: string;
    minutes: number;
    tasks: (string | { exercise: string; screen: number })[];
  }[];
}
const sets = (parse(readFileSync("content/assessments.yaml", "utf8")) as SetFile).sets;
/** The reference answer of each task in a set, from the exercise or mock task files. */
function answersOf(slug: string): string[] {
  const set = sets.find((s) => s.slug === slug);
  return (set?.tasks ?? []).map((t) => {
    const { exercise, screen } = typeof t === "string" ? { exercise: t, screen: 0 } : t;
    const mock = `content/mocks/${exercise}.yaml`;
    const path = existsSync(mock) ? mock : `content/exercises/${exercise}.yaml`;
    const file = parse(readFileSync(path, "utf8")) as {
      screens: { answer: string }[];
    };
    return file.screens[screen]?.answer ?? "";
  });
}
const input = (page: Page, task: number) => page.locator(`#t${task}-formula`);

async function signIn(page: Page, pro: boolean) {
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
}

test("the sample is marked only at the end, with every miss explained", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    // Usage counts are not results: the sample saves nothing until the end.
    if (r.method() === "POST" && !r.url().endsWith("/api/events/")) posts.push(r.url());
  });
  await page.goto(SAMPLE);
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  await expect(page.getByText("Task 1 of 3").first()).toBeVisible();
  const [first] = answersOf("sample");
  await input(page, 1).fill(first ?? "");
  await input(page, 1).press("Enter");
  // Saving moves on and shows no verdict.
  await expect(input(page, 2)).toBeFocused();
  await expect(page.locator("main")).not.toContainText("Correct.");
  await input(page, 2).fill("=1+1");
  await input(page, 2).press("Enter");
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("button", { name: "Finish with 1 blank" })).toBeVisible();
  await page.getByRole("button", { name: "Finish with 1 blank" }).click();
  await expect(page.locator("[data-score]")).toHaveText("1 of 3 correct");
  await expect(page.locator("#summary-title")).toBeFocused();
  const rows = page.locator("[data-results] > li");
  await expect(rows.locator(".mark-tag")).toHaveText(["Correct", "Missed", "Blank"]);
  await expect(rows.nth(1)).toContainText("=1+1");
  await expect(page.locator('[data-count="correct"]')).toHaveText("1");
  // The first miss is open; its button closes and reopens the explanation.
  const why = page.locator("[data-results] .why").first();
  await expect(why).toBeVisible();
  await expect(why).toContainText("Missing function in B8.");
  const missed = page.getByRole("button", { name: "Why it was missed" });
  await expect(missed).toHaveAttribute("aria-expanded", "true");
  await missed.click();
  await expect(why).toBeHidden();
  await missed.click();
  await expect(why).toBeVisible();
  await expect(why).toContainText("Answer: =COUNT(");
  // By function: weakest first, each miss with a link to practise it.
  const fns = page.locator("[data-by-function] tr");
  await expect(fns).toHaveCount(3);
  await expect(fns.filter({ hasText: "0 of 1" })).toHaveCount(2);
  await expect(page.locator("[data-by-function] a")).toHaveCount(2);
  await expect(page.locator("[data-save-note]")).toContainText("Not saved");
  expect(posts).toEqual([]);
});

test("a timed set's cover names each task, not the functions it needs", async ({ page }) => {
  await page.goto("/mock-assessments/data-analyst/");
  const items = page.locator(".a-list .a-item .fns");
  await expect(items.nth(2)).toHaveText("Best-selling product");
  await expect(page.locator(".a-list .a-item .fns a")).toHaveCount(0);
  await page.goto(SAMPLE);
  await expect(page.locator(".a-list .a-item .fns a").first()).toHaveText("SUM");
});

test("a reload keeps the answers and the clock", async ({ page }) => {
  await page.goto(SAMPLE);
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  await input(page, 1).fill("=SUM(B2:B5)");
  await page.reload();
  await expect(page.locator('[data-stage="test"]')).toBeVisible();
  await expect(input(page, 1)).toHaveValue("=SUM(B2:B5)");
  await expect(page.locator("[data-clock]")).toHaveText(/^9:5\d$|^10:00$/u);
});

test("time running out ends the attempt and blanks count as missed", async ({ page }) => {
  await page.clock.install();
  await page.goto(SAMPLE);
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  await page.clock.fastForward("10:01");
  await expect(page.locator("[data-score]")).toHaveText("0 of 3 correct");
  await expect(page.locator("[data-results] .mark-tag").first()).toHaveText("Blank");
});

test("the time limit can be turned off", async ({ page }) => {
  await page.goto(SAMPLE);
  await page.getByLabel(/No time limit/u).check();
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  await expect(page.locator("[data-clock-box]")).toBeHidden();
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: /Finish with 3 blank/u }).click();
  await expect(page.locator("[data-time]")).toContainText("untimed");
});

test("a PRO set stays locked for a free account", async ({ page }) => {
  await page.goto(PRO_SET);
  await expect(page.locator("[data-paywall]")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Start: \d+ minutes$/u })).toBeHidden();
  await signIn(page, false);
  await page.reload();
  await expect(page.locator("[data-paywall-text]")).toContainText("Your plan is Free");
  await expect(page.getByRole("button", { name: /^Start: \d+ minutes$/u })).toBeHidden();
});

test("a PRO account takes a PRO set and the result is saved once", async ({ page }) => {
  await page.goto(PRO_SET);
  await signIn(page, true);
  const bodies: unknown[] = [];
  await page.route("**/api/assessments/", (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({
        json: [
          {
            assessment: "office-essentials",
            started_at: "2026-11-01T10:00:00.000Z",
            finished_at: "2026-11-01T10:25:00.000Z",
            time_limit_s: 1800,
            score: 6,
            total: 10,
          },
        ],
      });
    bodies.push(r.request().postDataJSON());
    return r.fulfill({
      status: 201,
      json: { saved: true, id: "11111111-2222-4333-8444-555555555555", score: 10, total: 10 },
    });
  });
  await page.reload();
  await expect(page.locator("[data-paywall]")).toHaveCount(0);
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  const answers = answersOf("office-essentials");
  for (const [i, answer] of answers.entries()) {
    await input(page, i + 1).fill(answer);
    await input(page, i + 1).press("Enter");
  }
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.locator("[data-score]")).toHaveText(
    `${answers.length} of ${answers.length} correct`,
  );
  await expect(page.locator("[data-save-note]")).toHaveText("Saved to your history.");
  await expect(page.locator("[data-best]")).toHaveText("6 of 10");
  await expect(page.locator("[data-by-function] a")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("[data-save-note]")).toHaveText("Saved to your history.");
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ assessment: "office-essentials", timeLimit: 30 * 60 });
  // Only the formulas go to the server, which marks them itself.
  expect((bodies[0] as { formulas: string[] }).formulas).toEqual(answers);
  expect(bodies[0]).not.toHaveProperty("results");
});

test("a PRO set's page holds none of its answers", async ({ request }) => {
  for (const set of sets.filter((s) => s.slug !== "sample")) {
    const html = await (await request.get(`/mock-assessments/${set.slug}/`)).text();
    for (const answer of answersOf(set.slug)) {
      const forms = [answer, JSON.stringify(answer).slice(1, -1).replaceAll("<", "\\u003c")];
      for (const form of forms) expect(html, `${set.slug}: ${answer}`).not.toContain(form);
    }
    expect(html).not.toContain('"accept":');
  }
});

test("after Finish, the review shows each PRO answer fetched from the server", async ({ page }) => {
  await page.goto(PRO_SET);
  await signIn(page, true);
  await page.route("**/api/assessments/", (r) =>
    r.request().method() === "GET"
      ? r.fulfill({ json: [] })
      : r.fulfill({
          status: 201,
          json: { saved: true, id: "11111111-2222-4333-8444-555555555555", score: 0, total: 10 },
        }),
  );
  const fetched: string[] = [];
  await page.route("**/api/exercises/*/", (r) => {
    const slug = new URL(r.request().url()).pathname.split("/").at(-2) ?? "";
    fetched.push(slug);
    const mock = `content/mocks/${slug}.yaml`;
    const file = parse(
      readFileSync(existsSync(mock) ? mock : `content/exercises/${slug}.yaml`, "utf8"),
    ) as {
      screens: { answer: string }[];
    };
    return r.fulfill({ json: { answers: file.screens.map((s) => s.answer) } });
  });
  await page.reload();
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  const answers = answersOf("office-essentials");
  for (const i of answers.keys()) {
    await input(page, i + 1).fill("=1");
    await input(page, i + 1).press("Enter");
  }
  // Nothing is asked for until the attempt ends.
  expect(fetched).toEqual([]);
  await page.getByRole("button", { name: "Finish" }).click();
  for (const [i, answer] of answers.entries()) {
    const row = page.locator(`#answer-${i + 1}`);
    // The first miss opens by itself; the others open on their button.
    if (i > 0) await row.getByRole("button", { name: /Why it was missed/u }).click();
    await expect(row).toContainText(`Answer: ${answer}`);
  }
});

test("the assessment works from the keyboard alone", async ({ page }) => {
  await page.goto(SAMPLE);
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).focus();
  await page.keyboard.press("Enter");
  await expect(input(page, 1)).toBeFocused();
  await page.keyboard.type("=1");
  await page.keyboard.press("Enter");
  await expect(input(page, 2)).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /^Finish/u })).toBeFocused();
});

test("Save and next works without the keyboard, and counts what is answered", async ({ page }) => {
  await page.goto(SAMPLE);
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  await input(page, 1).fill("=SUM(B2:B5)");
  await page.getByRole("button", { name: "Save and next" }).click();
  await expect(page.getByText("Task 2 of 3")).toBeVisible();
  await expect(page.locator("[data-answered]")).toHaveText("1 of 3 answered");
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.getByText("Task 1 of 3")).toBeVisible();
  await expect(input(page, 1)).toHaveValue("=SUM(B2:B5)");
});

test("the clock turns amber with five minutes left", async ({ page }) => {
  await page.clock.install();
  await page.goto(SAMPLE);
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  await page.clock.fastForward("05:10");
  await expect(page.locator("[data-clock-box]")).toHaveClass(/\bwarn\b/u);
  await page.clock.fastForward("04:00");
  await expect(page.locator("[data-clock-box]")).toHaveClass(/\blow\b/u);
});

test("a blank task shows its answer when opened", async ({ page }) => {
  await page.goto(SAMPLE);
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  await input(page, 1).fill("=SUM(B2:B5)");
  await input(page, 1).press("Enter");
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: /Finish with/u }).click();
  // The first blank is open on its own; the second opens on request.
  const blanks = page.getByRole("button", { name: "See the answer" });
  await expect(blanks).toHaveCount(2);
  await blanks.nth(1).click();
  await expect(page.locator("[data-results] .why").nth(1)).toContainText("Answer: =IF(");
});

test("the index lists the assessments, and Your best only when signed in", async ({ page }) => {
  await page.goto("/mock-assessments/");
  const rows = page.locator(".sets > li");
  await expect(rows).toHaveCount(6);
  for (const name of [
    "Sample assessment",
    "Beginner",
    "Intermediate",
    "Office essentials",
    "Data analyst",
    "Finance",
  ])
    await expect(page.getByRole("link", { name })).toBeVisible();
  await expect(page.getByRole("figure")).toHaveCount(0);
  await expect(page.getByText("Your best:")).toHaveCount(6);
  for (const best of await page.getByText("Your best:").all()) await expect(best).toBeHidden();
});

test("the first task has no Previous, the last has no Next, and the page does not jump", async ({
  page,
}) => {
  await page.goto(SAMPLE);
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  const footer = page.locator("footer.site-footer");
  const tops: number[] = [];
  for (const n of [1, 2, 3]) {
    await page.locator(`[data-goto="${n - 1}"]`).click();
    await expect(page.getByText(`Task ${n} of 3`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toHaveCount(n === 1 ? 0 : 1);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(
      n === 3 ? 0 : 1,
    );
    tops.push(await footer.evaluate((f) => f.getBoundingClientRect().top + window.scrollY));
  }
  expect(new Set(tops).size).toBe(1);
});

test("the result is a report: a summary, the answers, and what to practise", async ({ page }) => {
  await page.goto(SAMPLE);
  await page.getByRole("button", { name: /^Start: \d+ minutes$/u }).click();
  const [first] = answersOf("sample");
  await input(page, 1).fill(first ?? "");
  await input(page, 1).press("Enter");
  await input(page, 2).fill("=1+1");
  await input(page, 2).press("Enter");
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByRole("button", { name: /Finish with/u }).click();

  const summary = page.locator(".summary");
  await expect(summary.getByRole("button", { name: "Take it again" })).toBeVisible();
  await expect(summary.getByRole("link", { name: "All assessments" })).toBeVisible();
  await expect(summary.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.locator("#summary-title")).toHaveText(/Sample assessment\s*1 of 3 correct/u);
  // One bar segment per task, in order, and the counts that key it.
  await expect(page.locator("[data-bar] > span")).toHaveClass(["correct", "miss", "blank"]);
  for (const [mark, n] of [
    ["correct", "1"],
    ["miss", "1"],
    ["blank", "1"],
  ])
    await expect(page.locator(`[data-count="${mark}"]`)).toHaveText(n ?? "");

  // Only the first miss starts open; the blank opens on request.
  const blank = page.locator("#answer-3").getByRole("button", { name: "See the answer" });
  await expect(blank).toHaveAttribute("aria-expanded", "false");
  await blank.click();
  await expect(page.locator("#why-3")).toBeVisible();

  await expect(page.locator("[data-practise] a")).toHaveText([
    "Count the paid orders",
    "Pass or fail",
  ]);
});
