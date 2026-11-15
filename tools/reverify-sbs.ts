// Why this exists: side-by-side images for the reverification report. Each one
// puts the top of our page (from tools/reverify.ts) beside the matching
// reference screenshot in docs/research/spreadsheetcenter/shots/.
// Usage: node tools/reverify-sbs.ts <out-dir> [ours-dir] [--pair=name:width:left:right:label:label ...]
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const OUT = process.argv[2] ?? "docs/design/reverify/sbs";
const OURS = resolve(
  process.argv[3]?.startsWith("--")
    ? "docs/design/reverify"
    : (process.argv[3] ?? "docs/design/reverify"),
);
const REF = resolve("docs/research/spreadsheetcenter/shots");
/** [our page name, reference shot name]. */
const PAIRS: [string, string][] = [
  ["home", "home"],
  ["exercises", "exercises"],
  ["tracks", "tracks"],
  ["track-totals", "track"],
  ["exercise-basic", "exercise-basic"],
  ["exercise-lookup", "exercise-lookup"],
  ["exercise-advanced", "exercise-advanced"],
  ["functions", "functions"],
  ["function-sum", "function-sumif"],
  ["function-vlookup", "function-xlookup"],
  ["explainers", "explainers"],
  ["explainer", "explainer"],
  ["articles", "articles"],
  ["article-long", "article"],
  ["shortcuts", "shortcuts"],
  ["resources", "resources"],
  ["search", "search"],
  ["contact", "contact"],
  ["login", "login"],
  ["register", "register"],
  ["subscribe", "subscribe"],
  ["privacy", "privacy"],
  ["mock-assessments", "assessments"],
  ["not-found", "not-found"],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env["REVERIFY_CHANNEL"] ? { channel: process.env["REVERIFY_CHANNEL"] } : {},
);

/** Puts two images side by side, each cut to one screen, and saves the result. */
async function compose(
  name: string,
  width: number,
  a: string,
  b: string,
  labels: [string, string],
) {
  const height = width >= 1000 ? 800 : 812;
  const page = await browser.newPage({ viewport: { width: width * 2 + 24, height: height + 32 } });
  const cell = (src: string, label: string) =>
    `<figure><figcaption>${label}</figcaption><div style="width:${width}px;height:${height}px;overflow:hidden;background:#fff"><img src="data:image/jpeg;base64,${readFileSync(src).toString("base64")}" style="width:${width}px;display:block"></div></figure>`;
  await page.setContent(
    `<body style="margin:0;display:flex;gap:24px;font:600 14px system-ui;background:#ddd">${cell(a, labels[0])}${cell(b, labels[1])}</body><style>figure{margin:0}figcaption{height:32px;line-height:32px;padding:0 8px}</style>`,
  );
  await page.waitForLoadState("load");
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 70 });
  await page.close();
}

// --pair=<name>:<width>:<left image>:<right image>:<left label>:<right label> composes one pair.
const pairs = process.argv.filter((a) => a.startsWith("--pair=")).map((a) => a.slice(7).split(":"));
if (pairs.length > 0) {
  for (const [name = "", width = "1280", a = "", b = "", la = "Ours", lb = "Reference"] of pairs)
    await compose(name, Number(width), a, b, [la, lb]);
} else {
  for (const width of [1280, 375]) {
    for (const [ours, ref] of PAIRS) {
      const a = `${OURS}/${ours}-${width}-light.jpg`;
      const b = `${REF}/${ref}-${width}.jpg`;
      if (existsSync(a) && existsSync(b))
        await compose(`${ours}-${width}`, width, a, b, [`Ours: ${ours}`, `Reference: ${ref}`]);
    }
  }
}
await browser.close();
console.log(`Side-by-side images in ${OUT}/`);
