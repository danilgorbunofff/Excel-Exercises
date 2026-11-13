// Why this exists: evidence for the Phase 2 mocks. For every direction and page
// it takes 375 and 1280 px shots in light and dark, runs axe, checks that the
// task, input, grid and verdict fit one 375 x 812 screen, and checks 320 px.
// Run: node docs/directions/build.ts && node docs/directions/shoot.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { DIRECTIONS } from "./tokens.ts";

const PAGES = ["landing", "exercise-wrong", "exercise-correct"] as const;
const THEMES = ["light", "dark"] as const;
const OUT = "docs/directions/shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const report: Record<string, unknown>[] = [];

for (const d of DIRECTIONS) {
  for (const p of PAGES) {
    const url = `file://${resolve(`docs/directions/${d.id}/${p}.html`)}`;
    const row: Record<string, unknown> = { direction: d.name, page: p };
    for (const theme of THEMES) {
      for (const width of [375, 1280]) {
        const context = await browser.newContext({
          viewport: { width, height: width === 375 ? 812 : 800 },
          colorScheme: theme,
        });
        const page = await context.newPage();
        await page.goto(url);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `${OUT}/${d.id}-${p}-${width}-${theme}.jpg`,
          type: "jpeg",
          quality: 70,
        });
        if (width === 375) {
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          row[`axe-${theme}`] = axe.violations
            .filter((v) => v.impact === "serious" || v.impact === "critical")
            .map((v) => `${v.id} (${v.nodes.length})`);
          if (p !== "landing" && theme === "light") {
            row["fitsPhoneScreen"] = await page.evaluate(() => {
              const bottom = (s: string) =>
                document.querySelector(s)?.getBoundingClientRect().bottom ?? Number.NaN;
              const parts = {
                task: bottom(".prompt"),
                input: bottom(".formula"),
                grid: bottom(".grid"),
                verdict: bottom(".verdict"),
              };
              return {
                ...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v)])),
                allVisible: Object.values(parts).every((v) => v <= innerHeight),
              };
            });
          }
        }
        await context.close();
      }
    }
    const narrow = await browser.newPage({ viewport: { width: 320, height: 640 } });
    await narrow.goto(url);
    row["sidewaysScrollAt320"] = await narrow.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    await narrow.close();
    report.push(row);
    console.log(JSON.stringify(row));
  }
}
await browser.close();
writeFileSync("docs/directions/checks.json", `${JSON.stringify(report, null, 2)}\n`);
