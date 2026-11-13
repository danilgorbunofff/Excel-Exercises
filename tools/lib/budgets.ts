// Why this exists: measures what a page costs to load, gzipped, so CI can fail
// a change that breaks the size budgets. Reading files is injected for tests.
import { posix } from "node:path";
import { gzipSync } from "node:zlib";

export const BUDGETS = {
  /** HTML plus all CSS needed for first paint, gzipped, in bytes. */
  firstPaintBytes: 40_000,
  /** JavaScript loaded by a route, gzipped, in bytes. */
  jsBytes: 70_000,
} as const;

export interface PageMeasure {
  route: string;
  firstPaintBytes: number;
  jsBytes: number;
  jsFiles: string[];
  missing: string[];
}

type ReadAsset = (path: string) => Buffer | undefined;

const gz = (b: Buffer | string) => gzipSync(b).length;
const resolve = (from: string, ref: string) =>
  ref.startsWith("/")
    ? posix.normalize(ref)
    : posix.normalize(posix.join(posix.dirname(from), ref));
const pageBase = (route: string) => (route.endsWith("/") ? `${route}index.html` : route);

/** Static imports and side-effect imports, but not dynamic import(). */
function staticImports(js: string): string[] {
  const out: string[] = [];
  for (const m of js.matchAll(
    /(?<![\w$.])import\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"']+)["']/gu,
  )) {
    if (m[1]) out.push(m[1]);
  }
  for (const m of js.matchAll(/(?<![\w$.])export\s*(?:\*|\{[^}]*\})\s*from\s*["']([^"']+)["']/gu)) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

export function measurePage(html: string, route: string, read: ReadAsset): PageMeasure {
  const base = pageBase(route);
  const missing: string[] = [];
  let firstPaintBytes = gz(html);

  for (const m of html.matchAll(/<link\b[^>]*>/giu)) {
    const tag = m[0];
    const href = /href=["']?([^"'\s>]+)/iu.exec(tag)?.[1];
    if (!href || !/rel=["']?stylesheet/iu.test(tag) || /^[a-z]+:/iu.test(href)) continue;
    const path = resolve(base, href);
    const css = read(path);
    if (css) firstPaintBytes += gz(css);
    else missing.push(path);
  }

  const queue: { path: string; from: string }[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)) {
    const src = /src=["']?([^"'\s>]+)/iu.exec(m[1] ?? "")?.[1];
    if (src) queue.push({ path: resolve(base, src), from: base });
    else
      for (const ref of staticImports(m[2] ?? ""))
        queue.push({ path: resolve(base, ref), from: base });
  }
  for (const m of html.matchAll(/<link\b[^>]*rel=["']?modulepreload[^>]*>/giu)) {
    const href = /href=["']?([^"'\s>]+)/iu.exec(m[0])?.[1];
    if (href) queue.push({ path: resolve(base, href), from: base });
  }

  const jsFiles: string[] = [];
  let jsBytes = 0;
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || jsFiles.includes(next.path) || missing.includes(next.path)) continue;
    const js = read(next.path);
    if (!js) {
      missing.push(next.path);
      continue;
    }
    jsFiles.push(next.path);
    jsBytes += gz(js);
    for (const ref of staticImports(js.toString("utf8"))) {
      if (ref.startsWith(".") || ref.startsWith("/"))
        queue.push({ path: resolve(next.path, ref), from: next.path });
    }
  }
  return { route, firstPaintBytes, jsBytes, jsFiles, missing };
}
