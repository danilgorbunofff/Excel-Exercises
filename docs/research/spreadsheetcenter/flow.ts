// Why this exists: walks the Spreadsheet Center exercise flow step by step and
// records every state: hints, the Answer tab, the timer, wrong and correct
// answers, the completion dialog, reload, Reset, keyboard order and the
// accessibility tree. Run: node docs/research/spreadsheetcenter/flow.ts
import { writeFileSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";

const URL = "https://spreadsheetcenter.com/excel-exercises/basic-sum-monthly-revenue/";
const SHOTS = "docs/research/spreadsheetcenter/shots";
const log: Record<string, unknown> = {};
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${SHOTS}/flow-${name}.jpg`, type: "jpeg", quality: 65 });
const visible = (page: Page) => page.evaluate(() => document.body.innerText);
const diff = (a: string, b: string) => {
  const seen = new Set(a.split("\n").map((l) => l.trim()));
  return b
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !seen.has(l))
    .slice(0, 20);
};
const storage = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage).map((k) => [k, (localStorage.getItem(k) ?? "").slice(0, 300)]),
    ),
  );
const gridReady = (page: Page) =>
  page.waitForFunction(
    "[...document.querySelectorAll('canvas')].some(c => c.offsetWidth > 250 && c.offsetHeight > 200)",
    undefined,
    { timeout: 45_000 },
  );

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "load" });
await gridReady(page);
await page.waitForTimeout(2000);
await shot(page, "01-initial");
log.storageInitial = await storage(page);
log.timerAt2s = await page.evaluate(() => document.body.innerText.match(/\d\d:\d\d:\d\d/)?.[0]);
await page.waitForTimeout(5000);
log.timerAt7s = await page.evaluate(() => document.body.innerText.match(/\d\d:\d\d:\d\d/)?.[0]);

// The exercise panel's accessible structure.
log.ariaExercisePanel = await page
  .locator("main")
  .first()
  .ariaSnapshot()
  .catch((e) => String(e));

// Hints are <details> elements.
let before = await visible(page);
const summaries = page.locator("details summary");
log.detailsCount = await summaries.count();
for (let i = 0; i < Math.min(await summaries.count(), 4); i++) {
  const s = summaries.nth(i);
  if (await s.isVisible()) await s.click();
}
await page.waitForTimeout(500);
log.hintsText = diff(before, await visible(page));
await shot(page, "02-hints-open");

// The Answer tab.
before = await visible(page);
const answerTab = page
  .getByRole("tab", { name: /answer/i })
  .or(page.getByRole("button", { name: /^answer$/i }))
  .first();
if (await answerTab.isVisible().catch(() => false)) {
  await answerTab.click();
  await page.waitForTimeout(800);
  log.answerTabText = diff(before, await visible(page));
  await shot(page, "03-answer-tab");
  const exTab = page
    .getByRole("tab", { name: /exercise/i })
    .or(page.getByRole("button", { name: /^exercise$/i }))
    .first();
  await exTab.click().catch(() => undefined);
  await page.waitForTimeout(500);
} else {
  log.answerTabText = "no Answer tab found by role";
}

// A wrong answer: one row short.
before = await visible(page);
await page.mouse.click(837, 379);
await page.keyboard.type("=SUM(B2:B6)");
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
log.wrongNewText = diff(before, await visible(page));
log.storageAfterWrong = await storage(page);
await shot(page, "04-wrong");

// The correct answer and the completion dialog.
before = await visible(page);
await page.mouse.click(837, 379);
await page.keyboard.type("=SUM(B2:B7)");
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
log.correctNewText = diff(before, await visible(page));
log.dialog = await page.evaluate(() => {
  const d = [...document.querySelectorAll("[role=dialog],dialog,[aria-modal]")].find(
    (e) => (e as HTMLElement).offsetParent !== null,
  );
  const a = document.activeElement as HTMLElement | null;
  return {
    found: Boolean(d),
    role: d?.getAttribute("role"),
    ariaModal: d?.getAttribute("aria-modal"),
    labelledby: d?.getAttribute("aria-labelledby"),
    tag: d?.tagName,
    activeElement: a
      ? `${a.tagName} ${a.innerText?.slice(0, 40) ?? ""} ${a.getAttribute("aria-label") ?? ""}`
      : null,
    liveRegions: [...document.querySelectorAll("[aria-live],[role=status],[role=alert]")].map((e) =>
      (e as HTMLElement).innerText.slice(0, 80),
    ),
  };
});
log.storageAfterCorrect = await storage(page);
await shot(page, "05-correct-dialog");

// Close the dialog and look at the completed state.
before = await visible(page);
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
log.afterEscapeNewText = diff(before, await visible(page));
log.dialogClosedByEscape = await page.evaluate(
  () =>
    ![...document.querySelectorAll("[role=dialog],dialog,[aria-modal]")].some(
      (e) => (e as HTMLElement).offsetParent !== null,
    ),
);
await shot(page, "06-after-close");

// Reload: is completion or the draft remembered?
await page.reload({ waitUntil: "load" });
await gridReady(page);
await page.waitForTimeout(2500);
log.afterReloadTextHead = (await visible(page)).split("\n").slice(0, 30);
await shot(page, "07-after-reload");

// Reset.
before = await visible(page);
const reset = page.getByRole("button", { name: /reset/i }).first();
log.resetState = await reset
  .evaluate((b) => ({
    disabled: (b as HTMLButtonElement).disabled,
    title: b.getAttribute("title"),
    visible: (b as HTMLElement).offsetParent !== null,
  }))
  .catch((e) => String(e));
try {
  await reset.click({ timeout: 3000 });
  await page.waitForTimeout(1200);
  log.afterResetNewText = diff(before, await visible(page));
  await shot(page, "08-after-reset");
} catch (e) {
  // After a reload the completion overlay covers the grid, including Reset.
  log.resetBlocked =
    String(e)
      .split("\n")
      .find((l) => l.includes("intercepts")) ?? String(e).slice(0, 120);
}

// Keyboard: tab from the top until focus reaches the grid or 45 stops.
await page.goto(URL, { waitUntil: "load" });
await gridReady(page);
await page.waitForTimeout(1500);
const stops: string[] = [];
for (let i = 1; i <= 45; i++) {
  await page.keyboard.press("Tab");
  const s = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    const r = a.getBoundingClientRect();
    const outline =
      getComputedStyle(a).outlineStyle !== "none" || getComputedStyle(a).boxShadow !== "none";
    return `${a.tagName.toLowerCase()}${a.getAttribute("role") ? `[${a.getAttribute("role")}]` : ""} "${(a.innerText || a.getAttribute("aria-label") || a.getAttribute("placeholder") || "").trim().slice(0, 30)}" at ${Math.round(r.x)},${Math.round(r.y)} visibleRing=${outline}`;
  });
  stops.push(`${i}. ${s}`);
}
log.tabStops = stops;
await ctx.close();

// Phone: what the first screens show, and whether the grid draws.
const phone = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const p = await phone.newPage();
await p.goto(URL, { waitUntil: "load" });
await p.waitForTimeout(4000);
await shot(p, "09-phone-top");
const gridTop = await p.evaluate(() => {
  const c = [...document.querySelectorAll("canvas")].sort(
    (a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight,
  )[0];
  return c ? Math.round(c.getBoundingClientRect().top + scrollY) : null;
});
log.phoneGridTop = gridTop;
await p.evaluate(() => {
  const c = [...document.querySelectorAll("canvas")].sort(
    (a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight,
  )[0];
  (c?.closest("section,div") ?? c)?.scrollIntoView({ block: "start" });
});
await p.waitForTimeout(3000);
await shot(p, "10-phone-grid");
log.phoneCanvases = await p.evaluate(() =>
  [...document.querySelectorAll("canvas")].map((c) => `${c.offsetWidth}x${c.offsetHeight}`),
);
await phone.close();
await browser.close();
writeFileSync(
  "docs/research/spreadsheetcenter/flow.json",
  `${JSON.stringify({ recordedAt: new Date().toISOString(), url: URL, ...log }, null, 2)}\n`,
);
console.log("done");
