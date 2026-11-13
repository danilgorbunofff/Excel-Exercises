// Why this exists: evidence for the exercise screen. It builds nothing; it runs
// the built site, drives a real exercise into its initial, wrong and correct
// states at 375, 768 and 1280 px in light and dark, saves a screenshot of what
// is on screen, and measures whether the task, input, grid and verdict fit.
// Run after `npm run build`: node tools/shoot-exercise.ts
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";

const PORT = 4329;
const BASE = `http://localhost:${PORT}`;
const OUT = "docs/design/shots";
const EXERCISE = "/exercises/sum-a-column/";
const STATES = {
  initial: null,
  wrong: "=SUM(B2:B4)",
  correct: "=SUM(B2:B5)",
} as const;
const SIZES = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

async function waitForServer(url: string) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server at ${url} did not start`);
}

async function measureFit(page: Page) {
  return page.evaluate(() => {
    const bottom = (sel: string) =>
      document.querySelector(sel)?.getBoundingClientRect().bottom ?? -1;
    return {
      prompt: bottom(".prompt"),
      input: bottom("#formula"),
      grid: bottom("[data-grid]"),
      verdict: bottom("[data-status]"),
      viewport: window.innerHeight,
      sideScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

const server: ChildProcess = spawn(
  "npx",
  ["astro", "preview", "--port", String(PORT), "--ignore-lock"],
  { stdio: "ignore" },
);
const checks: Record<string, unknown> = {};
try {
  await waitForServer(`${BASE}/`);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const scheme of ["light", "dark"] as const) {
    for (const size of SIZES) {
      for (const [state, formula] of Object.entries(STATES)) {
        const context = await browser.newContext({ viewport: size, colorScheme: scheme });
        const page = await context.newPage();
        await page.goto(`${BASE}${EXERCISE}`);
        await page.evaluate(() => document.fonts.ready);
        if (formula) {
          await page.fill("#formula", formula);
          await page.press("#formula", "Enter");
          // Screenshots show the page as it rests, without the focus ring on Next.
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        }
        const name = `${state}-${size.width}-${scheme}`;
        await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 82 });
        checks[name] = await measureFit(page);
        await context.close();
      }
    }
  }
  // 320 px: nothing scrolls sideways.
  const narrow = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const page = await narrow.newPage();
  await page.goto(`${BASE}${EXERCISE}`);
  await page.fill("#formula", STATES.wrong);
  await page.press("#formula", "Enter");
  checks["wrong-320-light"] = await measureFit(page);
  await page.screenshot({ path: `${OUT}/wrong-320-light.jpg`, type: "jpeg", quality: 82 });
  await browser.close();
  writeFileSync("docs/design/checks.json", `${JSON.stringify(checks, null, 2)}\n`);
  for (const [name, c] of Object.entries(checks)) {
    const v = c as { verdict: number; viewport: number; sideScroll: boolean };
    console.log(
      `${name.padEnd(22)} verdict ends at ${Math.round(v.verdict)} of ${v.viewport}${v.sideScroll ? ", SCROLLS SIDEWAYS" : ""}`,
    );
  }
} finally {
  server.kill();
}
