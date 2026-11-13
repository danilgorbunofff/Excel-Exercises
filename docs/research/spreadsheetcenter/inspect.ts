// Why this exists: a repeatable, deep inspection of spreadsheetcenter.com, the
// reference the owner chose. For one page of every type it records layout,
// computed design values, requests, storage, structure and axe results, and
// takes viewport and full-page shots at 1280 and 375 px.
// Run: node docs/research/spreadsheetcenter/inspect.ts
import { readFileSync, writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, chromium } from "@playwright/test";

const BASE = "https://spreadsheetcenter.com";
const OUT = "docs/research/spreadsheetcenter";
export const PAGES: [string, string][] = [
  ["home", "/"],
  ["exercises", "/excel-exercises/"],
  ["tracks", "/excel-exercises/tracks/"],
  ["track", "/excel-exercises/tracks/beginner-essentials/"],
  ["exercise-basic", "/excel-exercises/basic-sum-monthly-revenue/"],
  ["exercise-lookup", "/excel-exercises/lookup-price-with-vlookup/"],
  ["exercise-advanced", "/excel-exercises/formula-kpi-dashboard-panel/"],
  ["functions", "/excel-functions/"],
  ["function-sumif", "/excel-functions/sumif/"],
  ["function-xlookup", "/excel-functions/xlookup/"],
  ["articles", "/excel-articles/"],
  ["article", "/excel-articles/vlookup-explained-in-2-minutes/"],
  ["explainers", "/excel-formula-explainer/"],
  ["explainer", "/excel-formula-explainer/filter-multiple-criteria/"],
  ["shortcuts", "/excel-shortcuts/"],
  ["assessments", "/mock-assessments/"],
  ["subscribe", "/subscribe/"],
  ["resources", "/resources/"],
  ["search", "/search/"],
  ["login", "/login/"],
  ["register", "/register/"],
  ["contact", "/contact/"],
  ["privacy", "/privacy/"],
  ["not-found", "/this-page-does-not-exist/"],
];

// Runs in the page: computed design values, structure and technology clues.
const COLLECT = () => {
  const top = (m: Record<string, number>, n = 12) =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  const bump = (m: Record<string, number>, k: string) => {
    m[k] = (m[k] ?? 0) + 1;
  };
  const els = [...document.querySelectorAll("body *")].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const m = {
    textColor: {},
    background: {},
    border: {},
    family: {},
    size: {},
    weight: {},
    sizeLine: {},
    radius: {},
    shadow: {},
    padding: {},
    gap: {},
    maxWidth: {},
    letterSpacing: {},
  } as Record<string, Record<string, number>>;
  for (const e of els) {
    const s = getComputedStyle(e);
    const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
    if (hasText) {
      bump(m.textColor!, s.color);
      bump(m.family!, s.fontFamily.split(",")[0]!.replaceAll('"', "").trim());
      bump(m.size!, s.fontSize);
      bump(m.weight!, s.fontWeight);
      bump(m.sizeLine!, `${s.fontSize}/${s.lineHeight}`);
      if (s.letterSpacing !== "normal") bump(m.letterSpacing!, `${s.fontSize} ${s.letterSpacing}`);
    }
    if (s.backgroundColor !== "rgba(0, 0, 0, 0)") bump(m.background!, s.backgroundColor);
    if (s.borderTopStyle !== "none" && s.borderTopWidth !== "0px")
      bump(m.border!, `${s.borderTopWidth} ${s.borderTopColor}`);
    if (s.borderTopLeftRadius !== "0px") bump(m.radius!, s.borderTopLeftRadius);
    if (s.boxShadow !== "none") bump(m.shadow!, s.boxShadow);
    if (s.paddingTop !== "0px" || s.paddingLeft !== "0px")
      bump(m.padding!, `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`);
    if (s.rowGap !== "normal" && s.rowGap !== "0px") bump(m.gap!, s.rowGap);
    if (s.maxWidth !== "none") bump(m.maxWidth!, s.maxWidth);
  }
  const styleOf = (sel: string) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const s = getComputedStyle(e);
    return {
      text: (e as HTMLElement).innerText?.trim().slice(0, 60),
      family: s.fontFamily,
      size: s.fontSize,
      weight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      color: s.color,
      background: s.backgroundColor,
      padding: s.padding,
      radius: s.borderRadius,
      border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
      height: Math.round(e.getBoundingClientRect().height),
      width: Math.round(e.getBoundingClientRect().width),
      shadow: s.boxShadow,
      transition: s.transition,
    };
  };
  const rootVars: Record<string, string> = {};
  for (const sheet of [...document.styleSheets]) {
    try {
      for (const rule of [...sheet.cssRules]) {
        const r = rule as CSSStyleRule;
        if (r.selectorText && /(^|,)\s*(:root|html)\b/.test(r.selectorText)) {
          for (const p of [...r.style])
            if (p.startsWith("--")) rootVars[p] = r.style.getPropertyValue(p).trim();
        }
      }
    } catch {
      // Cross-origin sheets cannot be read.
    }
  }
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
    try {
      const j = JSON.parse(s.textContent ?? "");
      return [j]
        .flat()
        .map((x) => x["@type"])
        .join(",");
    } catch {
      return "unparseable";
    }
  });
  const focusables = [
    ...document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]"),
  ].filter((e) => (e as HTMLElement).offsetParent !== null && (e as HTMLElement).tabIndex >= 0);
  return {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    robots: document.querySelector('meta[name="robots"]')?.getAttribute("content"),
    generator: document.querySelector('meta[name="generator"]')?.getAttribute("content"),
    lang: document.documentElement.lang,
    colorSchemeMeta: document.querySelector('meta[name="color-scheme"]')?.getAttribute("content"),
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
    htmlDataset: { ...document.documentElement.dataset },
    htmlClass: document.documentElement.className,
    outline: [...document.querySelectorAll("h1,h2,h3")]
      .map((h) => `${h.tagName} ${(h as HTMLElement).innerText.trim().slice(0, 70)}`)
      .slice(0, 40),
    landmarks: Object.fromEntries(
      [
        "header",
        "nav",
        "main",
        "footer",
        "aside",
        "form",
        "table",
        "canvas",
        "iframe",
        "details",
        "dialog",
      ].map((t) => [t, document.querySelectorAll(t).length]),
    ),
    astroIslands: document.querySelectorAll("astro-island").length,
    islandComponents: [
      ...new Set(
        [...document.querySelectorAll("astro-island")].map((i) =>
          i.getAttribute("component-url")?.split("/").pop(),
        ),
      ),
    ],
    scripts: [...document.scripts].map((s) => s.src.replace(location.origin, "")).filter(Boolean),
    jsonLd,
    firstFocusables: focusables
      .slice(0, 8)
      .map(
        (e) =>
          `${e.tagName} ${((e as HTMLElement).innerText || e.getAttribute("aria-label") || (e as HTMLInputElement).placeholder || "").trim().slice(0, 30)}`,
      ),
    focusableCount: focusables.length,
    fontsLoaded: [...document.fonts]
      .filter((f) => f.status === "loaded")
      .map((f) => `${f.family} ${f.weight} ${f.style}`),
    rootVars,
    tokens: Object.fromEntries(Object.entries(m).map(([k, v]) => [k, top(v)])),
    samples: {
      body: styleOf("body"),
      h1: styleOf("h1"),
      h2: styleOf("h2"),
      h3: styleOf("h3"),
      p: styleOf("main p"),
      link: styleOf("main a"),
      header: styleOf("header"),
      navLink: styleOf("header nav a, header a"),
      primaryButton: styleOf("main a[class*=btn], main button, main a[class*=button]"),
      input: styleOf("input"),
      footer: styleOf("footer"),
      card: styleOf("[class*=card]"),
      badge: styleOf("[class*=badge], [class*=pill], [class*=tag]"),
    },
    pageHeight: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth > innerWidth,
    localStorage: (() => {
      try {
        return Object.keys(localStorage);
      } catch {
        return null;
      }
    })(),
    cookies: document.cookie
      .split(";")
      .map((c) => c.split("=")[0]?.trim())
      .filter(Boolean),
  };
};

async function visit(ctx: BrowserContext, name: string, path: string, width: number) {
  const page = await ctx.newPage();
  const requests: { url: string; type: string; status: number }[] = [];
  page.on("response", (r) =>
    requests.push({ url: r.url(), type: r.request().resourceType(), status: r.status() }),
  );
  const res = await page.goto(BASE + path, { waitUntil: "load", timeout: 45_000 });
  await page.waitForTimeout(4500);
  const data = await page.evaluate(COLLECT);
  const perf = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const by: Record<string, { count: number; kb: number }> = {};
    for (const r of res) {
      const k = r.initiatorType;
      by[k] = by[k] ?? { count: 0, kb: 0 };
      by[k].count++;
      by[k].kb += r.transferSize / 1024;
    }
    return {
      ttfbMs: Math.round(n.responseStart),
      dclMs: Math.round(n.domContentLoadedEventEnd),
      loadMs: Math.round(n.loadEventEnd),
      htmlKb: Math.round(n.transferSize / 102.4) / 10,
      byType: Object.fromEntries(
        Object.entries(by).map(([k, v]) => [k, { count: v.count, kb: Math.round(v.kb) }]),
      ),
      lcp: (
        performance.getEntriesByType("largest-contentful-paint").at(-1) as
          | PerformanceEntry
          | undefined
      )?.startTime,
    };
  });
  await page.screenshot({ path: `${OUT}/shots/${name}-${width}.jpg`, type: "jpeg", quality: 65 });
  // Very long pages are capped at 12,000 px so the screenshot can be encoded.
  const tall = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.screenshot({
    path: `${OUT}/shots/${name}-${width}-full.jpg`,
    type: "jpeg",
    quality: 55,
    fullPage: true,
    ...(tall > 12_000 ? { clip: { x: 0, y: 0, width, height: 12_000 } } : {}),
  });
  let axe: string[] = [];
  if (width === 1280) {
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    axe = r.violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length})`);
  }
  const hosts = [...new Set(requests.map((r) => new URL(r.url).hostname))];
  await page.close();
  return {
    status: res?.status(),
    finalUrl: res?.url(),
    ...data,
    perf,
    axe,
    hosts,
    requestCount: requests.length,
  };
}

const browser = await chromium.launch();
const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const phone = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const dark = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  colorScheme: "dark",
});
const results: Record<string, unknown> = {};
const only = process.argv.slice(2);
const existing: Record<string, unknown> = only.length
  ? (
      JSON.parse(readFileSync(`${OUT}/inspect.json`, "utf8")) as {
        results: Record<string, unknown>;
      }
    ).results
  : {};
Object.assign(results, existing);
for (const [name, path] of PAGES.filter(([n]) => only.length === 0 || only.includes(n))) {
  try {
    const d = await visit(desktop, name, path, 1280);
    const p = await visit(phone, name, path, 375);
    results[name] = {
      path,
      desktop: d,
      phone: {
        overflowX: p.overflowX,
        pageHeight: p.pageHeight,
        firstFocusables: p.firstFocusables,
        perf: p.perf,
      },
    };
    console.log("ok", name, d.status, d.title);
  } catch (e) {
    console.log("fail", name, String(e).slice(0, 100));
  }
}
for (const name of only.length ? [] : ["home", "exercise-basic", "function-sumif"]) {
  const page = await dark.newPage();
  await page.goto(BASE + PAGES.find((p) => p[0] === name)![1], { waitUntil: "load" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/shots/${name}-1280-dark.jpg`, type: "jpeg", quality: 65 });
  await page.close();
}
await browser.close();
writeFileSync(
  `${OUT}/inspect.json`,
  `${JSON.stringify({ inspectedAt: new Date().toISOString(), results }, null, 2)}\n`,
);
console.log("Wrote inspect.json");
