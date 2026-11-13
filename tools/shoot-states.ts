// Why this exists: evidence that every component looks right in every state.
// It drives the real exercise page into each state, light and dark, and saves
// an element screenshot. States the page never shows on its own are forced
// and marked so in the index. It also times grading in the browser, which
// decides whether any component needs a loading state.
// Run after `npm run build`: node tools/shoot-states.ts
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { type Browser, chromium, type Locator, type Page } from "@playwright/test";

const PORT = 4330;
const BASE = `http://localhost:${PORT}`;
const OUT = "docs/design/states";
const SUM = `${BASE}/exercises/sum-a-column/`;

interface Shot {
  component: string;
  state: string;
  how: "real" | "forced";
  run: (page: Page) => Promise<Locator>;
  phone?: boolean;
}

const q = (page: Page, sel: string) => page.locator(sel).first();
async function check(page: Page, formula: string) {
  await page.fill("#formula", formula);
  await page.press("#formula", "Enter");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

const SHOTS: Shot[] = [
  {
    component: "Primary button",
    state: "default",
    how: "real",
    run: async (p) => q(p, "[data-check]"),
  },
  {
    component: "Primary button",
    state: "hover",
    how: "real",
    run: async (p) => {
      await q(p, "[data-check]").hover();
      return q(p, "[data-check]");
    },
  },
  {
    component: "Primary button",
    state: "focus",
    how: "real",
    run: async (p) => {
      await q(p, "#formula").focus();
      await p.keyboard.press("Tab");
      await p.keyboard.press("Tab");
      return q(p, "[data-check]");
    },
  },
  {
    component: "Primary button",
    state: "active",
    how: "real",
    run: async (p) => {
      await q(p, "[data-check]").hover();
      await p.mouse.down();
      return q(p, "[data-check]");
    },
  },
  {
    component: "Primary button",
    state: "disabled",
    how: "forced",
    run: async (p) => {
      await q(p, "[data-check]").evaluate((b) => b.setAttribute("disabled", ""));
      return q(p, "[data-check]");
    },
  },
  {
    component: "Next button",
    state: "default",
    how: "real",
    run: async (p) => {
      await check(p, "=SUM(B2:B5)");
      return q(p, "[data-status]");
    },
  },
  {
    component: "Next button",
    state: "hover",
    how: "real",
    run: async (p) => {
      await check(p, "=SUM(B2:B5)");
      await q(p, "[data-next]").hover();
      return q(p, "[data-status]");
    },
  },
  {
    component: "Next button",
    state: "focus",
    how: "real",
    run: async (p) => {
      await p.keyboard.press("Tab");
      await p.fill("#formula", "=SUM(B2:B5)");
      await p.press("#formula", "Enter");
      return q(p, "[data-status]");
    },
  },
  {
    component: "Hint link",
    state: "default",
    how: "real",
    run: async (p) => q(p, "[data-hint-next]"),
  },
  {
    component: "Hint link",
    state: "hover",
    how: "real",
    run: async (p) => {
      await q(p, "[data-hint-next]").hover();
      return q(p, "[data-hint-next]");
    },
  },
  {
    component: "Hint link",
    state: "focus",
    how: "real",
    run: async (p) => {
      await q(p, "#formula").focus();
      await p.keyboard.press("Tab");
      return q(p, "[data-hint-next]");
    },
  },
  {
    component: "Sheet bar and Reset",
    state: "disabled",
    how: "real",
    run: async (p) => q(p, ".sheet-bar"),
  },
  {
    component: "Sheet bar and Reset",
    state: "default",
    how: "real",
    run: async (p) => {
      await p.fill("#formula", "=SUM(");
      return q(p, ".sheet-bar");
    },
  },
  {
    component: "Sheet bar and Reset",
    state: "hover",
    how: "real",
    run: async (p) => {
      await p.fill("#formula", "=SUM(");
      await q(p, "[data-reset]").hover();
      return q(p, ".sheet-bar");
    },
  },
  {
    component: "Sheet bar and Reset",
    state: "focus",
    how: "real",
    run: async (p) => {
      await p.fill("#formula", "=SUM(");
      await p.keyboard.press("Shift+Tab");
      return q(p, ".sheet-bar");
    },
  },
  { component: "Formula bar", state: "empty", how: "real", run: async (p) => q(p, ".formula-row") },
  {
    component: "Formula bar",
    state: "focus",
    how: "real",
    run: async (p) => {
      await p.keyboard.press("Tab");
      await p.keyboard.press("Enter");
      return q(p, ".formula-row");
    },
  },
  {
    component: "Formula bar",
    state: "typed",
    how: "real",
    run: async (p) => {
      await p.fill("#formula", "=SUM(B2:B5)");
      await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      return q(p, ".formula-row");
    },
  },
  {
    component: "Formula bar",
    state: "error",
    how: "real",
    run: async (p) => {
      await check(p, "=SUM(B2:B5");
      return q(p, ".formula-row");
    },
  },
  {
    component: "Formula bar",
    state: "read references",
    how: "real",
    run: async (p) => {
      await check(p, "=SUM(B2:B3)+B5");
      return q(p, ".formula-row");
    },
  },
  {
    component: "Grid",
    state: "empty answer cell",
    how: "real",
    run: async (p) => q(p, "[data-grid]"),
  },
  {
    component: "Grid",
    state: "wrong",
    how: "real",
    run: async (p) => {
      await check(p, "=SUM(B2:B4)");
      return q(p, "[data-grid]");
    },
  },
  {
    component: "Grid",
    state: "correct",
    how: "real",
    run: async (p) => {
      await check(p, "=SUM(B2:B5)");
      return q(p, "[data-grid]");
    },
  },
  { component: "Status bar", state: "empty", how: "real", run: async (p) => q(p, "[data-status]") },
  {
    component: "Status bar",
    state: "error, no formula",
    how: "real",
    run: async (p) => {
      await q(p, "[data-check]").click();
      await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      return q(p, "[data-status]");
    },
  },
  {
    component: "Status bar",
    state: "error, wrong result",
    how: "real",
    run: async (p) => {
      await check(p, "=SUM(B2:B4)");
      return q(p, "[data-status]");
    },
  },
  {
    component: "Status bar",
    state: "error, syntax",
    how: "real",
    run: async (p) => {
      await check(p, "=SUM(B2:B5");
      return q(p, "[data-status]");
    },
  },
  {
    component: "Status bar",
    state: "correct",
    how: "real",
    run: async (p) => {
      await check(p, "=SUM(B2:B5)");
      return q(p, "[data-status]");
    },
  },
  { component: "Hints", state: "closed", how: "real", run: async (p) => q(p, "[data-hints]") },
  {
    component: "Hints",
    state: "open, with comparison",
    how: "real",
    run: async (p) => {
      await check(p, "=SUM(B2:B4)");
      for (let i = 0; i < 3; i++) await q(p, "[data-hint-next]").click();
      await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      return q(p, "[data-hints]");
    },
  },
  {
    component: "Hints",
    state: "focus",
    how: "real",
    run: async (p) => {
      await q(p, "[data-hint-next]").focus();
      await p.keyboard.press("Enter");
      return q(p, "[data-hints]");
    },
  },
  {
    component: "Header",
    state: "default, current page",
    how: "real",
    run: async (p) => q(p, ".site-header"),
  },
  {
    component: "Header",
    state: "link hover",
    how: "real",
    run: async (p) => {
      await p.getByRole("link", { name: "Functions" }).first().hover();
      return q(p, ".site-header");
    },
  },
  {
    component: "Header",
    state: "link focus",
    how: "real",
    run: async (p) => {
      await p.keyboard.press("Tab");
      await p.keyboard.press("Tab");
      await p.keyboard.press("Tab");
      return q(p, ".site-header");
    },
  },
  {
    component: "Header, phone",
    state: "default",
    how: "real",
    phone: true,
    run: async (p) => q(p, ".site-header"),
  },
  {
    component: "Header, phone",
    state: "menu hover",
    how: "real",
    phone: true,
    run: async (p) => {
      await p.getByRole("button", { name: "Menu" }).hover();
      return q(p, ".site-header");
    },
  },
  {
    component: "Header, phone",
    state: "menu open",
    how: "real",
    phone: true,
    run: async (p) => {
      await p.getByRole("button", { name: "Menu" }).click();
      return p.locator(":root");
    },
  },
  {
    component: "Skip link",
    state: "focus",
    how: "real",
    run: async (p) => {
      await p.keyboard.press("Tab");
      return p.locator(":root");
    },
  },
];

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

async function gradingTimes(browser: Browser): Promise<{ median: number; max: number }> {
  const page = await browser.newPage();
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const routes = [...xml.matchAll(/<loc>[^<]*?(\/exercises\/[^<]+)<\/loc>/gu)].map((m) => m[1]);
  const times: number[] = [];
  for (const route of routes) {
    await page.goto(`${BASE}${route}`);
    const answer = (await page.locator('details[data-hint="3"] code').first().textContent()) ?? "";
    await page.fill("#formula", answer);
    // Submitting runs the grader and redraws synchronously, so this times both.
    times.push(
      await page.evaluate(() => {
        const form = document.querySelector<HTMLFormElement>("[data-form]");
        const t = performance.now();
        form?.requestSubmit();
        return performance.now() - t;
      }),
    );
  }
  await page.close();
  times.sort((a, b) => a - b);
  return { median: times[Math.floor(times.length / 2)] ?? 0, max: times.at(-1) ?? 0 };
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
  const rows: string[] = [];
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "");
  for (const shot of SHOTS) {
    const files: string[] = [];
    for (const colorScheme of ["light", "dark"] as const) {
      const viewport = shot.phone ? { width: 375, height: 812 } : { width: 1280, height: 800 };
      const context = await browser.newContext({ viewport, colorScheme });
      const page = await context.newPage();
      await page.goto(SUM);
      await page.evaluate(() => document.fonts.ready);
      const target = await shot.run(page);
      await page.waitForTimeout(200);
      const file = `${slug(shot.component)}--${slug(shot.state)}--${colorScheme}.png`;
      // Clip with a margin, so focus rings drawn outside the element are kept.
      // The page root means the visible screen.
      const isPage = (await target.evaluate((el) => el === document.documentElement)) as boolean;
      const box = isPage ? null : await target.boundingBox();
      const m = 8;
      await page.screenshot({
        path: `${OUT}/${file}`,
        ...(box
          ? {
              clip: {
                x: Math.max(0, box.x - m),
                y: Math.max(0, box.y - m),
                width: Math.min(viewport.width - Math.max(0, box.x - m), box.width + 2 * m),
                height: Math.min(viewport.height - Math.max(0, box.y - m), box.height + 2 * m),
              },
            }
          : {}),
      });
      files.push(file);
      await page.mouse.up();
      await context.close();
    }
    rows.push(
      `| ${shot.component} | ${shot.state} | ${shot.how} | ![${shot.component}, ${shot.state}, light](states/${files[0]}) | ![${shot.component}, ${shot.state}, dark](states/${files[1]}) |`,
    );
  }
  const timing = await gradingTimes(browser);
  await browser.close();
  const doc = [
    "# Component states",
    "",
    "Generated by `tools/shoot-states.ts` from the built exercise page in Chromium. A real state is reached by using the page. A forced state is set by the script, because the page never shows it on its own.",
    "",
    `**Loading.** No component has a loading state. The page is complete when it arrives, and grading all 24 reference answers in the browser took a median of ${timing.median.toFixed(2)} ms and at most ${timing.max.toFixed(2)} ms, grading and redraw included. A loading state would never be seen.`,
    "",
    "| Component | State | How | Light | Dark |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
  writeFileSync("docs/design/states.md", doc);
  console.log(
    `${rows.length} states in light and dark. Grading: median ${timing.median.toFixed(2)} ms, max ${timing.max.toFixed(2)} ms.`,
  );
} finally {
  server.kill();
}
