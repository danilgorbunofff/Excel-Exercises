// Why this exists: makes the two images that links to the site show when
// shared or saved to a phone's home screen: public/og.png (1200 by 630) and
// public/apple-touch-icon.png (180 by 180). They use the site's own name,
// colours, fonts and favicon, and nothing from another site. Run it again
// after the site name changes: npm run share-images
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { siteConfig } from "../site.config.ts";

const TAGLINE = "Practise Excel formulas on a real grid";
// From src/styles/tokens.css, light theme.
const COLOURS = {
  bg: "#f9fafb",
  surface: "#ffffff",
  text: "#101828",
  muted: "#4a5565",
  rule: "#e5e7eb",
  primary: "#18804f",
  panel: "#e9f5ee",
};

const dataUrl = (path: string, type: string) =>
  `data:${type};base64,${readFileSync(path).toString("base64")}`;
const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const fonts = `
  @font-face { font-family: Inter; font-weight: 400; src: url(${dataUrl("public/fonts/inter-latin-400-normal.woff2", "font/woff2")}); }
  @font-face { font-family: Inter; font-weight: 700; src: url(${dataUrl("public/fonts/inter-latin-700-normal.woff2", "font/woff2")}); }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; }
`;
const favicon = dataUrl("public/favicon.svg", "image/svg+xml");

// A few spreadsheet cells, so the card reads as the grid the site is about.
const cells = ["A", "B"]
  .map((col) => `<div class="cell head">${col}</div>`)
  .concat(
    ["Item", "Price", "Pens", "2.49", "Paper", "4.99", "Total", "=SUM(B2:B3)"].map(
      (t) => `<div class="cell">${t}</div>`,
    ),
  )
  .join("");

const card = `<!doctype html><html><head><style>${fonts}
  body { background: ${COLOURS.bg}; font-family: Inter, sans-serif; color: ${COLOURS.text};
    display: flex; flex-direction: column; justify-content: space-between; padding: 80px; }
  .brand { display: flex; align-items: center; gap: 24px; font-size: 44px; font-weight: 700; }
  .brand img { width: 72px; height: 72px; }
  h1 { font-size: 76px; font-weight: 700; line-height: 1.1; max-width: 640px; letter-spacing: -1px; }
  .grid { position: absolute; right: 80px; top: 170px; display: grid;
    grid-template-columns: 170px 260px; border: 2px solid ${COLOURS.rule};
    background: ${COLOURS.surface}; font-size: 28px; }
  .cell { height: 64px; padding: 0 16px; display: flex; align-items: center;
    border-right: 2px solid ${COLOURS.rule}; border-bottom: 2px solid ${COLOURS.rule}; }
  .head { background: ${COLOURS.panel}; color: ${COLOURS.muted}; justify-content: center; }
  .cell:last-child { outline: 4px solid ${COLOURS.primary}; outline-offset: -4px;
    color: ${COLOURS.primary}; font-weight: 700; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 20px; background: ${COLOURS.primary}; }
</style></head><body>
  <div class="brand"><img src="${favicon}" alt="">${escapeHtml(siteConfig.name)}</div>
  <h1>${escapeHtml(TAGLINE)}</h1>
  <div class="grid">${cells}</div>
  <div class="bar"></div>
</body></html>`;

const icon = `<!doctype html><html><head><style>${fonts}
  body { background: ${COLOURS.surface}; display: grid; place-items: center; }
  img { width: 132px; height: 132px; }
</style></head><body><img src="${favicon}" alt=""></body></html>`;

const browser = await chromium.launch();
try {
  for (const [html, width, height, out] of [
    [card, 1200, 630, "public/og.png"],
    [icon, 180, 180, "public/apple-touch-icon.png"],
  ] as const) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: "light" });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: out, type: "png" });
    await page.close();
    console.log(`Wrote ${out} (${width} by ${height}).`);
  }
} finally {
  await browser.close();
}
