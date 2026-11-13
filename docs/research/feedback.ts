// Why this exists: records what a canvas-grid practice site says about a
// wrong formula, so the research compares verdicts we actually saw.
// Run: node docs/research/feedback.ts  (writes feedback.json and shots/feedback-*.jpg)
import { writeFileSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";

interface Attempt {
  label: string;
  formula: string;
}

const visibleText = (page: Page) => page.evaluate(() => document.body.innerText);

function newLines(before: string, after: string): string[] {
  const seen = new Set(before.split("\n").map((l) => l.trim()));
  return after
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !seen.has(l))
    .slice(0, 12);
}

async function liveRegions(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[aria-live],[role=alert],[role=status]")]
      .map((e) => (e as HTMLElement).innerText.trim().replace(/\s+/g, " "))
      .filter(Boolean),
  );
}

const results: Record<string, unknown>[] = [];
const browser = await chromium.launch();

async function run(
  site: string,
  url: string,
  attempts: Attempt[],
  enter: (page: Page, formula: string) => Promise<void>,
  prepare?: (page: Page) => Promise<void>,
) {
  for (const [i, a] of attempts.entries()) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(
      "[...document.querySelectorAll('canvas')].some(c => c.offsetWidth > 250 && c.offsetHeight > 200)",
      undefined,
      { timeout: 45_000 },
    );
    await page.waitForTimeout(2000);
    if (prepare) await prepare(page);
    const before = await visibleText(page);
    await enter(page, a.formula);
    await page.waitForTimeout(2500);
    const shot = `docs/research/shots/feedback-${site}-${i + 1}.jpg`;
    await page.screenshot({ path: shot, type: "jpeg", quality: 60 });
    results.push({
      site,
      attempt: a.label,
      formula: a.formula,
      newText: newLines(before, await visibleText(page)),
      liveRegions: await liveRegions(page),
      screenshot: shot,
    });
    await page.close();
  }
}

await run(
  "spreadsheetcenter",
  "https://spreadsheetcenter.com/excel-exercises/basic-sum-monthly-revenue/",
  [
    { label: "range one row short", formula: "=SUM(B2:B6)" },
    {
      label: "typed numbers instead of references",
      formula: "=18200+16500+19350+21000+19800+22500",
    },
    { label: "correct", formula: "=SUM(B2:B7)" },
  ],
  async (page, formula) => {
    await page.mouse.click(837, 379); // cell B9 at 1280 x 800
    await page.keyboard.type(formula);
    await page.keyboard.press("Enter");
  },
);

// Coddy is left out: it serves a Cloudflare bot check to automated browsers,
// and this script does not try to get past it.

await browser.close();
writeFileSync(
  "docs/research/feedback.json",
  `${JSON.stringify({ recordedAt: new Date().toISOString(), results }, null, 2)}\n`,
);
console.log(JSON.stringify(results, null, 2));
