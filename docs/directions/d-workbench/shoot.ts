// Why this exists: evidence for the Workbench mocks. For each state it takes
// 375 and 1280 px shots in light and dark, runs axe, checks that the task,
// input, grid and verdict fit one screen on a phone (375 x 812) and on a
// desktop (1280 x 800), and checks for sideways scrolling at 320 px.
// Run: node docs/directions/d-workbench/build.ts && node docs/directions/d-workbench/shoot.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const DIR = "docs/directions/d-workbench";
mkdirSync(`${DIR}/shots`, { recursive: true });
const browser = await chromium.launch();
const report: Record<string, unknown>[] = [];

for (const state of ["initial", "wrong", "correct"]) {
  const url = `file://${resolve(`${DIR}/exercise-${state}.html`)}`;
  const row: Record<string, unknown> = { state };
  for (const theme of ["light", "dark"] as const) {
    for (const [w, h] of [
      [375, 812],
      [1280, 800],
    ] as const) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        colorScheme: theme,
      });
      const page = await ctx.newPage();
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${DIR}/shots/${state}-${w}-${theme}.jpg`,
        type: "jpeg",
        quality: 75,
      });
      if (theme === "light") {
        row[`fits-${w}`] = await page.evaluate(() => {
          const bottom = (s: string) =>
            Math.round(document.querySelector(s)?.getBoundingClientRect().bottom ?? Number.NaN);
          const parts = {
            task: bottom(".prompt"),
            input: bottom(".formula"),
            grid: bottom(".grid"),
            verdict: bottom(".status"),
          };
          return { ...parts, allVisible: Object.values(parts).every((v) => v <= innerHeight) };
        });
      }
      if (w === 375) {
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        row[`axe-${theme}`] = axe.violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => `${v.id} (${v.nodes.length})`);
      }
      await ctx.close();
    }
  }
  const narrow = await browser.newPage({ viewport: { width: 320, height: 640 } });
  await narrow.goto(url);
  row.sidewaysScrollAt320 = await narrow.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  await narrow.close();
  report.push(row);
  console.log(JSON.stringify(row));
}
await browser.close();
writeFileSync(`${DIR}/checks.json`, `${JSON.stringify(report, null, 2)}\n`);
