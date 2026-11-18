// Inlines the stylesheet (with the site tokens and base styles), fonts and
// scripts into each mock, so the mocks open straight from disk, then writes
// gallery.html, which shows every mock in one switchable frame.
// Usage: node docs/directions/practice-pages/build.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), "utf8");

const css = read("style.css")
  .replace(/@import url\("([^"]+)"\);/g, (_, p) => readFileSync(join(here, p), "utf8"))
  .replace(/url\("(\.\.\/[^"]+\.woff2)"\)/g, (_, p) =>
    `url("data:font/woff2;base64,${readFileSync(resolve(here, p)).toString("base64")}")`,
  );
const inline = (html) =>
  html
    .replace('<link rel="stylesheet" href="style.css" />', () => `<style>${css}</style>`)
    .replace(/<script src="(\w+\.js)"><\/script>/g, (_, f) => `<script>${read(f)}</script>`);

const pages = {};
for (const f of readdirSync(here).filter((n) => /^[a-cr]-\w+\.html$/.test(n)).sort()) {
  pages[f.replace(".html", "")] = inline(read(f));
}
const json = JSON.stringify(pages).replaceAll("<", "\\u003c");
writeFileSync(join(here, "gallery.html"), read("gallery.src.html").replace("/*PAGES*/{}", () => json));
console.log(`gallery.html: ${Object.keys(pages).length} mocks`);
