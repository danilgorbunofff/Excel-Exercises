// Why this exists: the pages and the rules that hold across all of
// them: one exercise order everywhere, the same footer on every page,
// breadcrumbs that never repeat a level, valid structured data, and no
// internal link that leads nowhere.
import { expect, type Page, test } from "@playwright/test";
import { sitemapRoutes } from "./routes.ts";

async function check(page: Page, formula: string) {
  await page.locator("#formula").fill(formula);
  await page.locator("#formula").press("Enter");
}

test("the home page runs the first exercise and leads to the second", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Practise Excel formulas on a real grid");
  await check(page, "=B2+B3");
  await expect(page.locator("[data-status]").first()).toContainText("Correct. B4 shows 29.49.");
  await expect(page.getByRole("link", { name: "Next: Subtract the costs" })).toHaveAttribute(
    "href",
    "/exercises/subtract-costs/",
  );
  await expect(
    page.getByText("46 of the 128 exercises, the hints and the function pages are free."),
  ).toBeVisible();
});

test("one order everywhere: the catalogue and every Next link follow the track", async ({
  page,
  request,
}) => {
  await page.goto("/exercises/");
  const order = await page
    .locator("tbody th a")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(order).toHaveLength(128);
  expect(order[0]).toBe("/exercises/add-two-cells/");
  expect(order.at(-1)).toBe("/exercises/top-three-customers-share/");
  const numbers = await page
    .locator("tbody tr[data-row]")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-order")));
  expect(numbers).toEqual(order.map((_, i) => String(i + 1)));
  for (const [i, href] of order.entries()) {
    const html = await (await request.get(href ?? "")).text();
    const next = /<a class="button button-next" href="([^"]+)"/u.exec(html)?.[1];
    expect(next, href ?? "").toBe(order[i + 1] ?? "/exercises/");
  }
});

test("the catalogue filters from a search, including one sent from the 404 page", async ({
  page,
}) => {
  await page.goto("/no-such-page/");
  await page.getByLabel("Search the exercises").fill("vlookup");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/exercises\/\?q=vlookup$/u);
  await expect(page.locator("tbody tr:not([hidden])")).toHaveCount(9);
  await expect(page.getByText("Showing 9 of 128 exercises.")).toBeVisible();
  await page.getByLabel("Find an exercise").fill("zzzz");
  await expect(page.getByText("No exercise matches.")).toBeVisible();
});

test("a track page lists its exercises and links up to the catalogue", async ({ page }) => {
  await page.goto("/exercises/tracks/lookups/");
  await expect(page.locator("[data-exercise-id]")).toHaveCount(11);
  await expect(page.locator("[data-up-next]:not([hidden])")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link")).toHaveText([
    "Exercises",
    "Learning tracks",
  ]);
  await expect(page.getByRole("link", { name: "Start track" })).toHaveAttribute(
    "href",
    "/exercises/find-a-price/",
  );
  // The old /topics/ address redirects on the host, which the preview server
  // does not run. tools/lib/vercel-config.test.ts checks that redirect.
});

test("track progress counts solved exercises, and the home sheet has no padding rows", async ({
  page,
}) => {
  await page.goto("/exercises/");
  await expect(page.getByText("0 of 4 solved").first()).toBeVisible();
  await page.goto("/");
  await expect(page.locator(".live .pad")).toHaveCount(0);
  await page.locator("#formula").fill("=B2+B3");
  await page.locator("#formula").press("Enter");
  await page.goto("/exercises/");
  await expect(page.getByText("1 of 4 solved").first()).toBeVisible();
});

test("the catalogue sorts by title and filters by difficulty and track", async ({ page }) => {
  await page.goto("/exercises/");
  await page.getByRole("button", { name: "Title", exact: true }).click();
  await expect(page.locator("thead th").filter({ hasText: "Title" })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  const titles = await page.locator("tbody th a").allTextContents();
  expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "en")));
  await page.getByLabel("Difficulty").selectOption("3");
  await expect(page.locator("tbody tr:not([hidden])")).toHaveCount(33);
  await page.getByLabel("Difficulty").selectOption("");
  await page.getByLabel("Track", { exact: true }).selectOption("logic");
  await expect(page.locator("tbody tr:not([hidden])")).toHaveCount(10);
  await expect(page.getByText("Showing 10 of 128 exercises.")).toBeVisible();
});

test("the header search suggests pages and the search page lists matches", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const box = page.getByRole("combobox", { name: "Search the site" }).first();
  await box.fill("vlookup");
  const list = page.getByRole("listbox", { name: "Suggestions" }).first();
  await expect(list.getByRole("option").first()).toContainText("VLOOKUP");
  await box.press("ArrowDown");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/functions\/vlookup\/$/u);
  await page.goto("/search/?q=lookup");
  await expect(page.getByText(/results for "lookup"/u)).toBeVisible();
  await expect(page.locator("[data-kind='Function'] li:not([hidden])")).not.toHaveCount(0);
});

test("articles list and open, and end with exercises", async ({ page }) => {
  await page.goto("/articles/");
  await page.getByRole("link", { name: /VLOOKUP or XLOOKUP/u }).click();
  await expect(page.locator("h1")).toHaveText("VLOOKUP or XLOOKUP");
  await expect(page.getByRole("heading", { name: "Practise what you read" })).toBeVisible();
});

test("Log in and Sign up post to the account functions, with Google as well", async ({ page }) => {
  for (const [path, action] of [
    ["/login/", "/api/auth/login/"],
    ["/register/", "/api/auth/register/"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByLabel("Email", { exact: true })).toBeEnabled();
    await expect(page.locator("form[data-auth-form]")).toHaveAttribute("action", action);
    await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
  }
  await page.goto("/login/?error=The+email+or+the+password+is+not+right.&next=/account/");
  await expect(page.getByRole("alert")).toHaveText("The email or the password is not right.");
  await expect(page.locator("[data-next-field]")).toHaveValue("/account/");
});

test("pricing shows Free beside PRO with a billing switch and a comparison", async ({ page }) => {
  await page.goto("/pricing/");
  await expect(page.getByRole("heading", { name: "Free", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PRO", exact: true })).toBeVisible();
  // Yearly is chosen first; without Stripe keys the page shows the list prices.
  const shown = page.locator(".pro .price strong").filter({ visible: true });
  await expect(page.getByRole("radio")).toHaveCount(4);
  await expect(page.getByRole("radio", { name: /Yearly/ })).toBeChecked();
  await expect(shown).toHaveText("$59");
  await expect(page.getByText("Best value")).toBeVisible();
  await expect(page.locator(".switch label", { hasText: "3 months" })).toContainText("−35%");
  await expect(page.locator(".switch label", { hasText: "Yearly" })).toContainText("−67%");
  await page.getByText("3 months", { exact: true }).click();
  await expect(shown).toHaveText("$29");
  await page.getByText("Lifetime", { exact: true }).first().click();
  await expect(shown).toHaveText("$129");
  await expect(shown.locator("xpath=../following-sibling::p")).toContainText("Launch offer");
  await page.getByText("Monthly", { exact: true }).click();
  await expect(shown).toHaveText("$15");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByText("6 months")).toHaveCount(0);
});

test("a PRO exercise shows the paywall over a made-up sheet, not the task or the answer", async ({
  page,
}) => {
  await page.goto("/exercises/find-a-code/");
  await expect(page.getByRole("heading", { name: "Solve this exercise with PRO" })).toBeVisible();
  await expect(page.locator("[data-paywall] .mock-sheet")).toBeVisible();
  // The task's own sheet stays out of view, and inert, until PRO opens it.
  const sheet = page.locator(".work[data-screen='0']");
  await expect(sheet).toBeHidden();
  await expect(sheet).toHaveAttribute("inert", "");
  await expect(page.getByRole("tab", { name: "Answer" })).toBeHidden();
  await expect(page.locator("[data-answer]").first()).toBeEmpty();
});

test("a function page has working contents, a checked date and a live exercise", async ({
  page,
}) => {
  await page.goto("/functions/vlookup/");
  const contents = page.getByRole("navigation", { name: "On this page" });
  for (const href of await contents
    .getByRole("link")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")))) {
    await expect(page.locator(href ?? "#missing")).toHaveCount(1);
  }
  const meta = page.locator(".meta").first();
  await expect(meta).toContainText("Checked against Microsoft Support");
  await expect(meta).toContainText("11 November 2026");
  await check(page, "=VLOOKUP(B8,A2:D6,4,FALSE)");
  await expect(page.locator("[data-status]").first()).toContainText("Correct. B9 shows 218.");
});

test("a Review link opens a run through the due list, with Previous and Next", async ({ page }) => {
  await page.addInitScript(
    (value) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("formula-practice:progress:v1", value);
        sessionStorage.setItem("seeded", "1");
      }
    },
    JSON.stringify({
      "add-two-cells": { state: "tried", date: "2026-01-01", misses: 2, missed: "2026-01-01" },
      "subtract-costs": { state: "tried", date: "2026-01-01", misses: 1, missed: "2026-01-01" },
    }),
  );
  await page.goto("/progress/");
  const rows = page.locator("[data-review-rows] tr");
  await expect(rows).toHaveCount(2);
  await expect(page.locator("[data-review-count]")).toHaveText("2 due");
  await expect(rows.first()).toContainText("Not solved yet, 2 wrong checks");
  // The filter narrows the table; clearing it brings both back.
  await page.getByLabel("Find an exercise").fill("subtract");
  await expect(rows).toHaveCount(1);
  await expect(page.locator("[data-review-count]")).toHaveText("Showing 1 of 2 due");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(2);
  await rows.nth(1).getByRole("link").click();
  const count = page.locator("[data-session-title]");
  await expect(count).toHaveText("Task 2 of 2");
  await expect(page.locator("[data-session-more-title]")).toBeHidden();
  await expect(page.locator("[data-session-next]")).toHaveAttribute("href", "/progress/");
  await page.locator("[data-session-prev]").click();
  await expect(count).toHaveText("Task 1 of 2");
  await expect(page.locator("[data-session-more-title]")).toHaveText("Next to review");
  await expect(page.locator("[data-session-finish]")).toBeHidden();
  await expect(page.locator("[data-session-back]")).toHaveText("← Back to your progress");
  await page.locator("[data-session-back]").click();
  await expect(page).toHaveURL(/\/progress\/$/u);
});

test("signed in, Clear my progress clears the account first, and keeps everything if it cannot", async ({
  page,
}) => {
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
  await page.route("**/api/daily/", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/events/", (r) => r.fulfill({ status: 204 }));
  let deleteOk = false;
  const deletes: string[] = [];
  await page.route("**/api/progress/", (r) => {
    const method = r.request().method();
    if (method === "DELETE") {
      deletes.push(method);
      return deleteOk
        ? r.fulfill({ json: { cleared: true } })
        : r.fulfill({ status: 500, json: {} });
    }
    return method === "GET"
      ? r.fulfill({ json: { "add-two-cells": { state: "solved", date: "2026-11-01" } } })
      : r.fulfill({ json: { saved: 1 } });
  });
  await page.goto("/progress/");
  await expect(page.locator('[data-stat="solved"]')).toHaveText("1");
  await expect(page.getByText("from your account, on every device.")).toBeVisible();

  await page.getByRole("button", { name: "Clear my progress" }).click();
  const ask = page.getByRole("dialog", { name: "Clear all your progress?" });
  await expect(ask).toContainText("your account, on every device you use");
  await page.getByRole("button", { name: "Yes, clear it" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Your account could not be reached, so nothing was cleared. Try again in a moment.",
  );
  await expect(ask).toBeVisible();
  await expect(page.locator('[data-stat="solved"]')).toHaveText("1");

  deleteOk = true;
  await page.getByRole("button", { name: "Yes, clear it" }).click();
  await expect(ask).toBeHidden();
  await expect(
    page.getByText("Your progress is cleared, on this and every other device."),
  ).toBeVisible();
  await expect(page.locator('[data-stat="solved"]')).toHaveText("0");
  expect(deletes).toHaveLength(2);
});

test("the progress page shows what is next, what is due, and clears", async ({ page }) => {
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  await page.addInitScript(
    (value) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("formula-practice:progress:v1", value);
        sessionStorage.setItem("seeded", "1");
      }
    },
    JSON.stringify({
      "add-two-cells": { state: "solved", date: day(-2), last: day(-2), reviews: 0 },
      "subtract-costs": { state: "helped", date: day(0), last: day(0), reviews: 0 },
    }),
  );
  await page.goto("/progress/");
  // Exercise 3 needs PRO, so a free visitor continues with the next free one.
  await expect(page.locator("[data-next]")).toHaveText("Continue: Add up a column");
  await expect(page.locator("[data-next]")).toHaveAttribute("href", "/exercises/sum-a-column/");
  await expect(page.locator('[data-stat="solved"]')).toHaveText("2");
  await expect(page.locator('[data-stat="own"]')).toHaveText("1");
  await expect(page.locator('[data-stat="helped"]')).toHaveText("1");
  await expect(page.locator('[data-stat="due"]')).toHaveText("1");

  await page.getByRole("button", { name: "Clear my progress" }).click();
  const ask = page.getByRole("dialog", { name: "Clear all your progress?" });
  await expect(ask).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep it" })).toBeFocused();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(ask).toBeHidden();
  await expect(page.locator('[data-stat="solved"]')).toHaveText("2");
  await page.getByRole("button", { name: "Clear my progress" }).click();
  await page.getByRole("button", { name: "Yes, clear it" }).click();
  await expect(page.getByText("Your progress is cleared.")).toBeVisible();
  await expect(page.locator('[data-stat="solved"]')).toHaveText("0");
  await expect(page.locator("[data-next]")).toHaveText("Start: Add two cells");
  await page.reload();
  await expect(page.locator('[data-stat="solved"]')).toHaveText("0");
});

test("every page shares the footer, keeps breadcrumbs honest and has valid structured data", async ({
  request,
}) => {
  let footer: string | null = null;
  for (const route of sitemapRoutes()) {
    const html = await (await request.get(route)).text();
    const links = [
      ...(/<nav aria-label="Footer"[\s\S]*?<\/nav>/u.exec(html)?.[0] ?? "").matchAll(
        />([^<]+)<\/a>/gu,
      ),
    ]
      .map((m) => m[1])
      .join("|");
    // Exercise pages drop the footer so scrolling the task never lands in it.
    const exercise = /^\/exercises\/(?!drills\/|tracks\/)[^/]+\/$/u.test(route);
    if (exercise) expect(links, route).toBe("");
    else {
      footer ??= links;
      expect(links, route).toBe(footer);
    }

    const crumbs = [
      ...(/<nav[^>]*aria-label="Breadcrumb"[\s\S]*?<\/nav>/u.exec(html)?.[0] ?? "").matchAll(
        />([^<]+)<\/a>/gu,
      ),
    ].map((m) => m[1]);
    const h1 = /<h1[^>]*>([^<]+)<\/h1>/u.exec(html)?.[1];
    expect(new Set(crumbs).size, route).toBe(crumbs.length);
    expect(crumbs, route).not.toContain(h1);

    for (const m of html.matchAll(
      /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gu,
    )) {
      expect(() => JSON.parse(m[1] ?? ""), route).not.toThrow();
    }
  }
  expect(footer).toBe(
    "Exercises|Function practice|Learning tracks|Daily exercise|Mock assessments|Progress|Functions|Articles|Keyboard shortcuts|Pricing|Terms|Privacy|Contact",
  );
});

test("no internal link leads to a missing page", async ({ request }) => {
  const seen = new Set<string>();
  for (const route of sitemapRoutes()) {
    const html = await (await request.get(route)).text();
    for (const m of html.matchAll(/href="(\/[^"#?]*)/gu)) {
      const href = m[1] ?? "";
      // /api/ runs on the host as a function, which the static test server does not have.
      const skip = ["/_astro/", "/fonts/", "/api/"].some((p) => href.startsWith(p));
      if (seen.has(href) || skip) continue;
      seen.add(href);
      const res = await request.get(href);
      expect(res.status(), `${href}, linked from ${route}`).toBe(200);
    }
  }
  expect(seen.size).toBeGreaterThan(30);
});

test("a function link lists only the exercises that use that function", async ({ page }) => {
  await page.goto("/functions/");
  await page
    .locator(".fn", { hasText: "Returns TRUE when at least one test is true." })
    .getByRole("link", { name: /exercise/u })
    .click();
  await expect(page).toHaveURL(/\/exercises\/\?fn=OR$/u);
  await expect(page.getByLabel("Function", { exact: true })).toHaveValue("OR");
  await expect(page.locator("tbody tr:not([hidden]) th a")).toHaveText([
    "Free delivery when either test passes",
    "AND, OR and NOT: combining tests",
  ]);
  await expect(page.getByText("Showing 2 of 128 exercises.")).toBeVisible();
});

test("search finds reference pages", async ({ page }) => {
  await page.goto("/search/?q=shortcuts");
  await expect(page.locator("[data-kind='Page'] li:not([hidden]) a")).toHaveText([
    "Keyboard shortcuts",
  ]);
});

test("the tracks page has three groups, the last for interviews", async ({ page }) => {
  await page.goto("/exercises/tracks/");
  await expect(page.locator("section.group:not(.how) h2")).toHaveText([
    "Start here if formulas are new to you",
    "Go deeper on one family of functions",
    "Prepare for a job interview",
  ]);
  const interview = page.getByRole("region", { name: "Prepare for a job interview" });
  await expect(interview.locator("article.track")).toHaveCount(6);
  await expect(interview.getByText("· 2 free")).toHaveCount(6);
  await expect(
    interview.getByRole("link", { name: "Start track: Accounting interview" }),
  ).toHaveAttribute("href", "/exercises/tracks/interview-accounting/");
});

test("an interview track lists its exercises, locks and mock assessment", async ({ page }) => {
  await page.goto("/exercises/tracks/interview-accounting/");
  await expect(page.locator("h1")).toHaveText("Accounting interview");
  await expect(page.locator("[data-exercise-id]")).toHaveCount(5);
  await expect(page.locator("[data-exercise-id] .badge-pro")).toHaveCount(3);
  await expect(page.locator("[data-exercise-id]").first().locator(".badge-pro")).toHaveCount(0);
  await expect(page.locator("[data-up-next]:not([hidden])")).toHaveCount(1);
  await expect(page.getByText("0 of 5 solved")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start track" })).toHaveAttribute(
    "href",
    "/exercises/days-overdue-on-open-invoices/",
  );
  await expect(page.getByRole("link", { name: /Mock assessment: Finance/u })).toHaveAttribute(
    "href",
    "/mock-assessments/finance/",
  );
});

test("a started track says Continue, and a solved exercise says Review", async ({ page }) => {
  await page.goto("/exercises/tracks/");
  await expect(page.getByRole("link", { name: /Continue track/u })).toHaveCount(0);
  await page.goto("/exercises/add-two-cells/");
  await check(page, "=B2+B3");
  // Signed out, the dialog offers an account to keep progress on every device.
  const dialog = page.getByRole("dialog", { name: "Exercise solved" });
  await expect(dialog.getByRole("link", { name: "Create an account" })).toBeVisible();
  await page.goto("/exercises/tracks/");
  await expect(
    page.getByRole("link", { name: "Continue track: Cells and arithmetic" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Start track/u })).toHaveCount(22);
  await page.goto("/exercises/tracks/references/");
  await expect(page.getByRole("link", { name: "Review: Add two cells" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start: Subtract the costs" })).toBeVisible();
});

test("articles show as cards, and an article offers more to read", async ({ page }) => {
  await page.goto("/articles/");
  await expect(page.locator(".article-card")).toHaveCount(53);
  await expect(page.locator(".article-card .cover code").first()).not.toBeEmpty();
  await page.getByRole("link", { name: "Relative and absolute references" }).click();
  await expect(page.locator(".cover code").first()).toHaveText("$A$1");
  const more = page.getByRole("region", { name: "More articles" });
  await expect(more.locator(".article-card")).toHaveCount(3);
});

test("a function page explains the function and its header example can be edited", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/functions/vlookup/");
  for (const name of ["About VLOOKUP", "Tips and notes", "Common questions"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  const out = page.locator("[data-explainer-out]");
  await expect(out).toHaveValue("85");
  await page.locator(".fn-head").getByRole("textbox", { name: "B5", exact: true }).fill("P-3");
  await expect(out).toHaveValue("30");
  await page.locator(".fn-head").getByRole("button", { name: "Reset" }).click();
  await expect(out).toHaveValue("85");
});
