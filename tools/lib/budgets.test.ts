import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { measurePage } from "./budgets.ts";

const assets: Record<string, string> = {
  "/_astro/a.css": "body{color:red}",
  "/_astro/page.js":
    'import"./shared.js";import{x}from"./util.js";const l=()=>import("./lazy.js");',
  "/_astro/shared.js": "export const s=1;",
  "/_astro/util.js": 'import"./shared.js";export const x=2;',
  "/_astro/lazy.js": "export default 3;",
};
const read = (p: string) => (p in assets ? Buffer.from(assets[p] ?? "") : undefined);
const gz = (s: string) => gzipSync(s).length;

describe("measurePage", () => {
  it("counts HTML plus linked CSS for first paint, and static JS imports once each", () => {
    const html = `<html><head><link rel="stylesheet" href="/_astro/a.css"></head>
      <body><script type="module" src="/_astro/page.js"></script></body></html>`;
    const m = measurePage(html, "/exercises/x/", read);
    expect(m.firstPaintBytes).toBe(gz(html) + gz(assets["/_astro/a.css"] ?? ""));
    expect(m.jsFiles).toEqual(["/_astro/page.js", "/_astro/shared.js", "/_astro/util.js"]);
    expect(m.jsBytes).toBe(m.jsFiles.reduce((n, f) => n + gz(assets[f] ?? ""), 0));
    expect(m.missing).toEqual([]);
  });

  it("resolves relative asset paths against the page and reports missing files", () => {
    const html = `<link rel="stylesheet" href="../gone.css"><script type="module">import "/_astro/util.js";</script>`;
    const m = measurePage(html, "/exercises/x/", read);
    expect(m.missing).toEqual(["/exercises/gone.css"]);
    expect(m.jsFiles).toEqual(["/_astro/util.js", "/_astro/shared.js"]);
  });
});
