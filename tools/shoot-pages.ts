// Why this exists: evidence for the Phase 6 pages. It runs the built site and
// saves a full-page screenshot of every page type at 375 and 1280 px, light
// and dark. The progress page is shot with sample progress in the browser, so
// its review list and counts show.
// Run after `npm run build`: node tools/shoot-pages.ts
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const PORT = 4332;
const BASE = `http://localhost:${PORT}`;
const OUT = "docs/pages/shots";
const PAGES = [
  ["home", "/"],
  ["catalogue", "/exercises/"],
  ["catalogue-search", "/exercises/?q=lookup"],
  ["track", "/exercises/tracks/totals/"],
  ["functions", "/functions/"],
  ["function-sum", "/functions/sum/"],
  ["function-vlookup", "/functions/vlookup/"],
  ["progress", "/progress/"],
  ["privacy", "/privacy/"],
  ["terms", "/terms/"],
  ["contact", "/contact/"],
  ["not-found", "/no-such-page/"],
] as const;

/** Sample progress: some solves are due for review, one was solved with help. */
function sampleProgress() {
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  return {
    "add-two-cells": { state: "solved", date: day(-9), last: day(-9), reviews: 1 },
    "subtract-costs": { state: "solved", date: day(-2), last: day(-2), reviews: 0 },
    "multiply-price-by-quantity": { state: "helped", date: day(-1), last: day(-1), reviews: 0 },
    "price-after-discount": { state: "solved", date: day(0), last: day(0), reviews: 0 },
  };
}

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

const server: ChildProcess = spawn(
  "npx",
  ["astro", "preview", "--port", String(PORT), "--ignore-lock"],
  { stdio: "ignore" },
);
try {
  await waitForServer(`${BASE}/`);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const colorScheme of ["light", "dark"] as const) {
    for (const width of [375, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 375 ? 812 : 800 },
        colorScheme,
      });
      await context.addInitScript(
        ([key, value]) => {
          if (location.pathname.startsWith("/progress/")) localStorage.setItem(key, value);
        },
        ["formula-practice:progress:v1", JSON.stringify(sampleProgress())] as const,
      );
      const page = await context.newPage();
      for (const [name, path] of PAGES) {
        await page.goto(`${BASE}${path}`);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `${OUT}/${name}-${width}-${colorScheme}.jpg`,
          type: "jpeg",
          quality: 80,
          fullPage: true,
        });
      }
      await context.close();
    }
  }
  await browser.close();
  console.log(`${PAGES.length} pages at 375 and 1280 px, light and dark, in ${OUT}/`);
} finally {
  server.kill();
}
