// Why this exists: evidence for the UI/UX reverification (docs/design/reverify).
// It serves the built site, opens every page type at six widths in light and
// dark, signed out and (where the page differs) as a free or PRO account, and
// records what can be measured: sideways scroll, axe findings, headings,
// landmarks, small targets, cookies, console errors, layout shift and script
// size. Images are kept only at 375 and 1280 px. A second pass drives the
// exercise through every state and walks the keyboard path.
// Accounts are emulated: the signed_in cookie plus mocked /api/* answers. No
// real sign-in happens, so the server side of auth is not tested here.
// Run after `npm run build`: node tools/reverify.ts [--only=<route-substring>]
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, type BrowserContext, chromium, type Page } from "@playwright/test";
import { parse } from "yaml";

const PORT = 4340;
const BASE = `http://localhost:${PORT}`;
const OUT = "docs/design/reverify";
const WIDTHS = [320, 375, 768, 1024, 1280, 1920] as const;
const SHOT_WIDTHS = new Set([375, 1280]);
const THEMES = ["light", "dark"] as const;
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

type Account = "out" | "free" | "pro";

/** [name, path, accounts]. Account pages and the PRO exercise also run signed in. */
const SIGNED: Account[] = ["out", "free", "pro"];
const PAGES: [string, string, Account[]][] = [
  ["home", "/", ["out"]],
  ["exercises", "/exercises/", SIGNED],
  ["daily", "/daily/", SIGNED],
  ["tracks", "/exercises/tracks/", ["out"]],
  ["track-totals", "/exercises/tracks/totals/", ["out"]],
  ["track-capstone", "/exercises/tracks/capstone/", ["out"]],
  ["exercise-basic", "/exercises/sum-a-column/", ["out"]],
  ["exercise-shortest", "/exercises/subtract-costs/", ["out"]],
  ["exercise-lookup", "/exercises/delivery-band/", ["out"]],
  ["exercise-advanced", "/exercises/a-commission-sheet-that-updates-itself/", ["out"]],
  ["exercise-longest", "/exercises/formula-audit-fix-five-broken-sheets/", ["out"]],
  ["exercise-pro", "/exercises/find-a-code/", SIGNED],
  ["functions", "/functions/", ["out"]],
  ["function-sum", "/functions/sum/", ["out"]],
  ["function-vlookup", "/functions/vlookup/", ["out"]],
  ["explainers", "/formula-explainer/", ["out"]],
  ["articles", "/articles/", ["out"]],
  ["article-long", "/articles/relative-and-absolute-references/", ["out"]],
  ["article-short", "/articles/reading-formula-errors/", ["out"]],
  ["shortcuts", "/excel-shortcuts/", ["out"]],
  ["resources", "/resources/", ["out"]],
  ["search", "/search/?q=sum", ["out"]],
  ["search-empty", "/search/?q=zzzzqx", ["out"]],
  ["contact", "/contact/", ["out"]],
  ["login", "/login/", ["out"]],
  ["register", "/register/", ["out"]],
  ["forgot-password", "/forgot-password/", ["out"]],
  ["reset-password", "/reset-password/", ["out"]],
  ["verify", "/verify/", ["out"]],
  ["account", "/account/", SIGNED],
  ["profile", "/profile/", SIGNED],
  ["progress", "/progress/", SIGNED],
  ["mock-assessments", "/mock-assessments/", SIGNED],
  ["mock-sample", "/mock-assessments/sample/", ["out"]],
  ["mock-office", "/mock-assessments/office-essentials/", SIGNED],
  ["pricing", "/pricing/", SIGNED],
  ["subscribe", "/subscribe/", SIGNED],
  ["privacy", "/privacy/", ["out"]],
  ["terms", "/terms/", ["out"]],
  ["not-found", "/no-such-page/", ["out"]],
];

/** The first explainer, from its YAML, so the route is real. */
const explainers = parse(readFileSync("content/explainers.yaml", "utf8")) as unknown;
const firstExplainer = (
  Array.isArray(explainers)
    ? explainers
    : ((explainers as Record<string, unknown[]>)["walkthroughs"] ?? [])
)[0] as { slug?: string } | undefined;
if (firstExplainer?.slug)
  PAGES.push(["explainer", `/formula-explainer/${firstExplainer.slug}/`, ["out"]]);

const proAnswers = (
  parse(readFileSync("content/exercises/find-a-code.yaml", "utf8")) as {
    screens: { answer: string }[];
  }
).screens.map((s) => s.answer);

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
  };
}

async function signIn(context: BrowserContext, account: Account) {
  if (account === "out") return;
  await context.addCookies([{ name: "signed_in", value: "1", domain: "localhost", path: "/" }]);
  const me = {
    email: "learner@example.test",
    pro: account === "pro",
    proStatus: account === "pro" ? "active" : null,
    proUntil: account === "pro" ? "2027-11-15" : null,
    news: false,
    hasPassword: true,
  };
  await context.route("**/api/me/", (r) => r.fulfill({ json: me }));
  await context.route("**/api/progress/", (r) =>
    r.fulfill({ json: r.request().method() === "GET" ? sampleProgress() : { ok: true } }),
  );
  await context.route("**/api/daily/", (r) =>
    r.request().method() === "GET"
      ? r.fulfill({ json: sampleDaily() })
      : r.fulfill({ status: 201, json: { saved: 1 } }),
  );
  await context.route("**/api/certificates/", (r) =>
    r.fulfill({
      json:
        account === "pro"
          ? [
              {
                id: "ValidCertificate000001",
                name: "Ada Lovelace",
                assessment: "office-essentials",
                assessment_title: "Office essentials",
                score: 9,
                total: 10,
                time_limit_s: 1800,
                issued_at: "2026-11-15T10:21:00.000Z",
                revoked_at: null,
              },
            ]
          : [],
    }),
  );
  await context.route("**/api/exercises/**", (r) =>
    account === "pro"
      ? r.fulfill({ json: { answers: proAnswers } })
      : r.fulfill({ status: 403, json: { error: "PRO needed" } }),
  );
}

/** A three-day streak ending today, with a gap before it, for the account card. */
function sampleDaily() {
  const day = (back: number) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  return [0, 1, 2, 4, 5].map((b) => ({ day: day(b), exercise: "sample" }));
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

const INIT = () => {
  const w = window as unknown as { __cls: number; __lcp: number };
  w.__cls = 0;
  w.__lcp = 0;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as (PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
    })[])
      if (!e.hadRecentInput) w.__cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) w.__lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
};

/** Everything measured from inside the page. */
function measure(touch: boolean) {
  const vw = document.documentElement.clientWidth;
  const label = (el: Element) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = el.classList.length ? `.${[...el.classList].slice(0, 2).join(".")}` : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const wide = [...document.querySelectorAll("body *")]
    .filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1)
    .filter((el) => !el.closest("[data-scroll-x], .table-wrap, .grid-wrap, pre"))
    .map(label)
    .slice(0, 6);
  const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
    .filter(visible)
    .map((h) => Number(h.tagName[1]));
  const skips = levels.filter((l, i) => i > 0 && l > (levels[i - 1] ?? 0) + 1).length;
  const min = touch ? 44 : 24;
  const small = [
    ...document.querySelectorAll(
      "a[href], button, input, select, textarea, summary, [role=tab], [tabindex='0']",
    ),
  ]
    .filter(visible)
    .filter((el) => {
      // WCAG 2.5.8 excepts links inside a sentence.
      if (
        el.tagName === "A" &&
        getComputedStyle(el).display === "inline" &&
        el.closest("p, li, td, dd")
      )
        return false;
      const r = el.getBoundingClientRect();
      return r.width < min || r.height < min;
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      return `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent ?? "").trim().slice(0, 24)}"`;
    });
  const w = window as unknown as { __cls: number; __lcp: number };
  return {
    sideScroll: document.documentElement.scrollWidth > window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    wide,
    h1: [...document.querySelectorAll("h1")].filter(visible).length,
    headingSkips: skips,
    landmarks: {
      main: document.querySelectorAll("main").length,
      banner: document.querySelectorAll("body > header, [role=banner]").length,
      contentinfo: document.querySelectorAll("body > footer, [role=contentinfo]").length,
    },
    smallTargets: small.length,
    smallExamples: small.slice(0, 5),
    title: document.title,
    description: document.querySelector("meta[name=description]")?.getAttribute("content") ?? null,
    canonical: document.querySelector("link[rel=canonical]")?.getAttribute("href") ?? null,
    robots: document.querySelector("meta[name=robots]")?.getAttribute("content") ?? null,
    ogImage: document.querySelector("meta[property='og:image']")?.getAttribute("content") ?? null,
    jsonLd: [...document.querySelectorAll("script[type='application/ld+json']")].map((s) => {
      try {
        const v = JSON.parse(s.textContent ?? "") as { "@type"?: string };
        return v["@type"] ?? "?";
      } catch {
        return "INVALID";
      }
    }),
    cls: Math.round(w.__cls * 1000) / 1000,
    lcp: Math.round(w.__lcp),
    height: document.documentElement.scrollHeight,
  };
}

async function openPage(page: Page, path: string) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  return res?.status() ?? 0;
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return r.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    n: v.nodes.length,
    target: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    summary: v.nodes[0]?.failureSummary?.split("\n").slice(0, 2).join(" ") ?? "",
  }));
}

async function pagePass(browser: Browser) {
  const cells: Record<string, unknown> = {};
  for (const [name, path, accounts] of PAGES) {
    if (ONLY && !name.includes(ONLY)) continue;
    for (const account of accounts) {
      for (const theme of THEMES) {
        for (const width of WIDTHS) {
          const touch = width <= 768;
          const context = await browser.newContext({
            viewport: { width, height: width <= 375 ? 812 : width === 768 ? 1024 : 900 },
            colorScheme: theme,
            hasTouch: touch,
            isMobile: touch && width < 768,
          });
          await context.addInitScript(INIT);
          await signIn(context, account);
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("console", (m) => {
            if (m.type() === "error") errors.push(m.text().slice(0, 160));
          });
          page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
          let js = 0;
          page.on("response", async (r) => {
            if (r.request().resourceType() === "script")
              js += (await r.body().catch(() => Buffer.alloc(0))).length;
          });
          const thirdParty: string[] = [];
          page.on("request", (r) => {
            if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) thirdParty.push(r.url());
          });
          const status = await openPage(page, path);
          const m = await page.evaluate(measure, touch);
          const violations = await axe(page);
          const cookies = (await context.cookies()).map((c) => c.name);
          const key = `${name}|${account}|${theme}|${width}`;
          cells[key] = { status, ...m, axe: violations, errors, js, thirdParty, cookies };
          const flagged =
            m.sideScroll ||
            violations.some((v) => v.impact === "serious" || v.impact === "critical");
          if (SHOT_WIDTHS.has(width) || flagged) {
            const acc = account === "out" ? "" : `-${account}`;
            await page.screenshot({
              path: `${OUT}/${name}${acc}-${width}-${theme}.jpg`,
              type: "jpeg",
              quality: 60,
              fullPage: true,
            });
          }
          console.log(
            `${key.padEnd(48)} ${status} ${m.sideScroll ? "SCROLL " : ""}axe:${violations.map((v) => v.id).join(",") || "0"} small:${m.smallTargets} h1:${m.h1}`,
          );
          await context.close();
        }
      }
    }
  }
  return cells;
}

/** Exercise states, keyboard path, divider, reset, reload, offline. */
async function exercisePass(browser: Browser) {
  const out: Record<string, unknown> = {};
  const path = "/exercises/sum-a-column/";
  const sizes = [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
    { width: 812, height: 375 },
  ];
  for (const theme of THEMES) {
    for (const size of sizes) {
      const tag = `${size.width}x${size.height}-${theme}`;
      const context = await browser.newContext({
        viewport: size,
        colorScheme: theme,
        hasTouch: size.width < 1000,
      });
      const page = await context.newPage();
      await openPage(page, path);
      const shot = (state: string) =>
        page.screenshot({ path: `${OUT}/exstate-${state}-${tag}.jpg`, type: "jpeg", quality: 60 });
      const state: Record<string, unknown> = {};
      await shot("initial");
      for (const n of [1, 2, 3]) {
        await page.click("[data-hint-next]").catch(() => undefined);
        await page.waitForTimeout(100);
        state[`hint${n}`] = await page.evaluate(() => ({
          open: [...document.querySelectorAll<HTMLDetailsElement>("details[data-hint]")]
            .filter((d) => d.offsetParent !== null || d.closest("[data-hints='0']"))
            .map((d) => d.open),
          hintButton: document.querySelector("[data-hint-next]")?.textContent?.trim(),
          focus: document.activeElement?.tagName,
        }));
        if (n < 3) await shot(`hint${n}`);
      }
      await shot("hint3");
      // Fresh page for wrong and correct, so step 3 does not mark "helped".
      await page.evaluate(() => localStorage.clear());
      await openPage(page, path);
      await page.fill("#formula", "=SUM(B2:B4)");
      await page.press("#formula", "Enter");
      await page.waitForTimeout(150);
      state["wrong"] = await page.evaluate(() => {
        const v = document.querySelector("[data-verdict]");
        return {
          text: v?.textContent?.replace(/\s+/gu, " ").trim().slice(0, 300),
          role: v?.getAttribute("role"),
          live: v?.getAttribute("aria-live"),
          verdictBottom: Math.round(
            document.querySelector("[data-status]")?.getBoundingClientRect().bottom ?? -1,
          ),
          viewport: innerHeight,
        };
      });
      await shot("wrong");
      await page.fill("#formula", "=SUM(B2:B5)");
      await page.press("#formula", "Enter");
      await page.waitForTimeout(300);
      state["correct"] = await page.evaluate(() => ({
        text: document
          .querySelector("[data-verdict]")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim()
          .slice(0, 200),
        dialogOpen: document.querySelector<HTMLDialogElement>("[data-done-dialog]")?.open ?? false,
        focus: `${document.activeElement?.tagName}.${document.activeElement?.className}`,
      }));
      await shot("correct");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      state["afterEscape"] = await page.evaluate(() => ({
        dialogOpen: document.querySelector<HTMLDialogElement>("[data-done-dialog]")?.open ?? false,
        focus: `${document.activeElement?.tagName}.${document.activeElement?.className} "${document.activeElement?.textContent?.trim().slice(0, 30)}"`,
      }));
      await shot("after-escape");
      await page.reload();
      await page.waitForTimeout(300);
      state["reload"] = await page.evaluate(() => ({
        formula: document.querySelector<HTMLInputElement>("#formula")?.value,
        verdict: document
          .querySelector("[data-verdict]")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim()
          .slice(0, 160),
        dialogOpen: document.querySelector<HTMLDialogElement>("[data-done-dialog]")?.open ?? false,
        resetDisabled: document.querySelector<HTMLButtonElement>("[data-reset]")?.disabled,
      }));
      await shot("reload");
      page.once("dialog", (d) => void d.accept());
      await page.click("[data-reset]").catch(() => undefined);
      await page.waitForTimeout(150);
      state["reset"] = await page.evaluate(() => ({
        formula: document.querySelector<HTMLInputElement>("#formula")?.value,
        verdict: document
          .querySelector("[data-verdict]")
          ?.textContent?.replace(/\s+/gu, " ")
          .trim()
          .slice(0, 160),
      }));
      if (size.width >= 1000) {
        const div = page.locator("[data-divider]");
        await div.focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        const afterKeys = await div.getAttribute("aria-valuenow");
        const box = await div.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + 100);
          await page.mouse.down();
          await page.mouse.move(box.x - 200, box.y + 100, { steps: 5 });
          await page.mouse.up();
        }
        state["divider"] = { afterKeys, afterDrag: await div.getAttribute("aria-valuenow") };
        await page.reload();
        state["dividerPersist"] = await div.getAttribute("aria-valuenow");
      }
      out[tag] = state;
      await context.close();
    }
  }
  // Keyboard path on a fresh exercise at 1280 light: first 40 Tab stops.
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await openPage(page, path);
  const stops: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    stops.push(
      await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a) return "none";
        const s = getComputedStyle(a);
        const ring =
          s.outlineStyle !== "none" && s.outlineWidth !== "0px"
            ? `outline ${s.outlineWidth}`
            : s.boxShadow !== "none"
              ? "shadow"
              : "NO-RING";
        const r = a.getBoundingClientRect();
        const off = r.bottom < 0 || r.top > innerHeight ? " OFFSCREEN" : "";
        return `${a.tagName.toLowerCase()}${a.id ? `#${a.id}` : ""} "${(a.getAttribute("aria-label") ?? a.textContent ?? "").trim().slice(0, 28)}" ${ring}${off}`;
      }),
    );
  }
  out["tabStops"] = stops;
  // Offline after load: checking still works, search page explains.
  await context.setOffline(true);
  await page.fill("#formula", "=SUM(B2:B5)");
  await page.press("#formula", "Enter");
  await page.waitForTimeout(200);
  out["offlineCheck"] = await page.evaluate(() =>
    document
      .querySelector("[data-verdict]")
      ?.textContent?.replace(/\s+/gu, " ")
      .trim()
      .slice(0, 120),
  );
  await context.setOffline(false);
  await context.close();
  // Search offline from a loaded page.
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const sp = await sctx.newPage();
  await openPage(sp, "/search/");
  await sctx.setOffline(true);
  const input = sp.locator("input[type=search]").first();
  await input.fill("vlookup").catch(() => undefined);
  await sp.keyboard.press("Enter").catch(() => undefined);
  await sp.waitForTimeout(500);
  out["offlineSearch"] = await sp.evaluate(() =>
    document.querySelector("main")?.textContent?.replace(/\s+/gu, " ").trim().slice(0, 300),
  );
  await sp.screenshot({ path: `${OUT}/search-offline-1280-light.jpg`, type: "jpeg", quality: 60 });
  await sctx.close();
  // Reduced motion: any running transition or animation over 0 s.
  const rctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const rp = await rctx.newPage();
  const moving: string[] = [];
  for (const p of ["/", path, "/exercises/"]) {
    await openPage(rp, p);
    moving.push(
      ...(await rp.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((el) => {
            const s = getComputedStyle(el);
            return (
              s.transitionDuration.split(",").some((d) => Number.parseFloat(d) > 0.01) ||
              (s.animationName !== "none" && Number.parseFloat(s.animationDuration) > 0.01)
            );
          })
          .map(
            (el) =>
              `${location.pathname} ${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`,
          )
          .slice(0, 10),
      )),
    );
  }
  out["reducedMotionMoving"] = moving;
  await rctx.close();
  return out;
}

const server: ChildProcess = spawn("node", ["tools/serve-static.ts", String(PORT)], {
  stdio: "ignore",
});
try {
  await waitForServer(`${BASE}/`);
  mkdirSync(OUT, { recursive: true });
  // REVERIFY_CHANNEL=chrome uses the installed Chrome when Playwright's own browsers are absent.
  const browser = await chromium.launch(
    process.env["REVERIFY_CHANNEL"] ? { channel: process.env["REVERIFY_CHANNEL"] } : {},
  );
  const notFound = await fetch(`${BASE}/no-such-page/`);
  const pages = await pagePass(browser);
  const exercise = !ONLY || ONLY === "exercise" ? await exercisePass(browser) : {};
  await browser.close();
  const file = ONLY ? `${OUT}/data-${ONLY}.json` : `${OUT}/data.json`;
  writeFileSync(
    file,
    `${JSON.stringify({ notFoundStatus: notFound.status, pages, exercise }, null, 2)}\n`,
  );
  console.log(`Wrote ${file}`);
} finally {
  server.kill();
}
