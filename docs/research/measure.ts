// Why this exists: measures comparable sites the same way each time, so the
// research notes rest on repeatable numbers. Run: node docs/research/measure.ts
// It loads each URL cold in headless Chromium on a phone profile with Slow 4G
// and 4x CPU slowdown, records when the exercise is usable, every request to
// another site, and what covers the screen, then takes 375 and 1280 px shots.
import { writeFileSync } from "node:fs";
import { type Browser, chromium } from "@playwright/test";

interface Target {
  name: string;
  url: string;
  /** Browser expression that is true once the learner can start typing. */
  ready?: string;
}

const LANDING = "document.readyState === 'complete'";
const GRID_CANVAS =
  "[...document.querySelectorAll('canvas')].some(c => c.offsetWidth > 250 && c.offsetHeight > 200)";
const EDITOR =
  "!!document.querySelector('.cm-editor, .monaco-editor, textarea:not([hidden]), [contenteditable=true]')";

export const TARGETS: Target[] = [
  { name: "excelexercises-home", url: "https://excelexercises.com/" },
  {
    name: "excelexercises-practice",
    url: "https://excelexercises.com/practice.html?lesson=89",
    ready:
      "!document.body.innerText.includes('Loading spreadsheet') && !!document.querySelector('td')",
  },
  { name: "spreadsheetcenter-home", url: "https://spreadsheetcenter.com/", ready: GRID_CANVAS },
  {
    name: "spreadsheetcenter-exercise",
    url: "https://spreadsheetcenter.com/excel-exercises/basic-sum-monthly-revenue/",
    ready: GRID_CANVAS,
  },
  { name: "coddy-excel", url: "https://coddy.tech/playground/excel", ready: GRID_CANVAS },
  { name: "excelpractices-home", url: "https://excelpractices.pages.dev/" },
  { name: "excelpractices-guide", url: "https://excelpractices.pages.dev/guide/arrow-keys" },
  { name: "automateexcel-formulas", url: "https://www.automateexcel.com/formulas-functions/" },
  {
    name: "w3schools-exercise",
    url: "https://www.w3schools.com/excel/exercise.php?filename=exercise_syntax1",
    ready: "!!document.querySelector('input[type=text], textarea')",
  },
  {
    name: "ref-microsoft-sumif",
    url: "https://support.microsoft.com/en-us/office/sumif-function-169b8c99-c05c-4483-a712-1697a653039b",
  },
  { name: "ref-exceljet-sumif", url: "https://exceljet.net/functions/sumif-function" },
  {
    name: "ref-ablebits-sumif",
    url: "https://www.ablebits.com/office-addins-blog/excel-sumif-function/",
  },
  { name: "ref-exceleasy-sumif", url: "https://www.excel-easy.com/examples/sumif.html" },
  { name: "freecodecamp-home", url: "https://www.freecodecamp.org/" },
  { name: "freecodecamp-learn", url: "https://www.freecodecamp.org/learn/" },
  { name: "exercism-home", url: "https://exercism.org/" },
  { name: "exercism-exercise", url: "https://exercism.org/tracks/python/exercises/hello-world" },
  { name: "executeprogram-home", url: "https://www.executeprogram.com/", ready: EDITOR },
  { name: "khanacademy-home", url: "https://www.khanacademy.org/" },
  { name: "brilliant-home", url: "https://brilliant.org/" },
  { name: "codecademy-home", url: "https://www.codecademy.com/" },
  { name: "codecademy-course", url: "https://www.codecademy.com/learn/learn-python-3" },
  { name: "datacamp-home", url: "https://www.datacamp.com/" },
  {
    name: "datacamp-course",
    url: "https://www.datacamp.com/courses/intro-to-python-for-data-science",
  },
  { name: "duolingo-home", url: "https://www.duolingo.com/" },
];

const siteOf = (host: string) => host.split(".").slice(-2).join(".");

const INSPECT = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const visible = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh; };
  const covers = [...document.querySelectorAll('body *')].filter((el) => {
    const s = getComputedStyle(el); if (s.position !== 'fixed' && s.position !== 'sticky') return false;
    if (!visible(el)) return false; const r = el.getBoundingClientRect();
    return (Math.min(r.right, vw) - Math.max(r.left, 0)) * (Math.min(r.bottom, vh) - Math.max(r.top, 0)) > vw * vh * 0.08;
  }).filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)))
    .map((el) => { const r = el.getBoundingClientRect(); return { position: getComputedStyle(el).position,
      coverPct: Math.round(((Math.min(r.right, vw) - Math.max(r.left, 0)) * (Math.min(r.bottom, vh) - Math.max(r.top, 0))) / (vw * vh) * 100),
      text: el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 140) }; });
  const dialogs = [...document.querySelectorAll('[role=dialog],[role=alertdialog],dialog[open],[aria-modal=true]')]
    .filter(visible).map((d) => d.innerText.replace(/\\s+/g, ' ').trim().slice(0, 140));
  return { title: document.title, h1: [...document.querySelectorAll('h1')].map((h) => h.innerText.trim().slice(0, 120)),
    covers, dialogs, overflowX: document.documentElement.scrollWidth > vw + 1,
    tables: document.querySelectorAll('table').length, canvases: document.querySelectorAll('canvas').length,
    iframes: [...document.querySelectorAll('iframe')].map((f) => f.src.slice(0, 80)).filter(Boolean) };
})()`;

async function measure(browser: Browser, t: Target) {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  // Lighthouse's Slow 4G profile and 4x CPU slowdown.
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  const result: Record<string, unknown> = { name: t.name, url: t.url };
  try {
    const response = await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    result["status"] = response?.status();
    result["finalUrl"] = page.url();
    try {
      await page.waitForFunction(t.ready ?? LANDING, undefined, { timeout: 45_000, polling: 100 });
      result["readyMs"] = Math.round(await page.evaluate(() => performance.now()));
    } catch {
      result["readyMs"] = "not ready within 45 s";
    }
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      return {
        dclMs: Math.round(n?.domContentLoadedEventEnd ?? 0),
        loadMs: Math.round(n?.loadEventEnd ?? 0),
      };
    });
    Object.assign(result, nav);
    await page.waitForTimeout(4000);
    Object.assign(result, await page.evaluate(INSPECT));
    await page.screenshot({
      path: `docs/research/shots/${t.name}-375.jpg`,
      type: "jpeg",
      quality: 55,
    });
  } catch (e) {
    result["error"] = String(e).slice(0, 200);
  }
  const here = siteOf(new URL(page.url() || t.url).hostname);
  const third: Record<string, number> = {};
  for (const u of requests) {
    try {
      const host = new URL(u).hostname;
      if (host && siteOf(host) !== here && siteOf(host) !== siteOf(new URL(t.url).hostname)) {
        third[host] = (third[host] ?? 0) + 1;
      }
    } catch {
      // data: and blob: URLs have no host.
    }
  }
  result["requests"] = requests.length;
  result["thirdPartyHosts"] = third;
  await context.close();

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dpage = await desktop.newPage();
  try {
    await dpage.goto(t.url, { waitUntil: "load", timeout: 45_000 });
    await dpage.waitForTimeout(4000);
    await dpage.screenshot({
      path: `docs/research/shots/${t.name}-1280.jpg`,
      type: "jpeg",
      quality: 55,
    });
    result["desktop"] = await dpage.evaluate(INSPECT);
  } catch (e) {
    result["desktopError"] = String(e).slice(0, 200);
  }
  await desktop.close();
  return result;
}

const only = process.argv.slice(2);
const browser = await chromium.launch();
const results = [];
for (const t of TARGETS.filter((x) => only.length === 0 || only.includes(x.name))) {
  const r = await measure(browser, t);
  console.log(
    JSON.stringify({
      name: r["name"],
      readyMs: r["readyMs"],
      third: Object.keys(r["thirdPartyHosts"] as object).length,
    }),
  );
  results.push(r);
}
await browser.close();
const out = only.length
  ? `docs/research/data-${only.join("_")}.json`
  : "docs/research/measurements.json";
writeFileSync(
  out,
  `${JSON.stringify({ measuredAt: new Date().toISOString(), profile: "375x812 mobile, Slow 4G (150 ms RTT, 1.6 Mbps down), 4x CPU, headless Chromium, cold cache", results }, null, 2)}\n`,
);
console.log(`Wrote ${out}`);
