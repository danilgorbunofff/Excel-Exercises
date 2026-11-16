// Why this exists: serves the built pages for the end-to-end tests. The Vercel
// adapter has no `astro preview`, and the tests only need the static pages,
// not the /api/* functions. With --ssr, the server-rendered certificate pages
// are rendered by the built function against fixed fixtures (tools/lib/ssr.ts).
// Usage: node tools/serve-static.ts <port> [--ssr]
import { readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { isSsrPath, ssrHandler } from "./lib/ssr.ts";

const ROOT = "dist/client";
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

function fileFor(urlPath: string): string | null {
  const path = join(ROOT, normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/u, ""));
  try {
    const s = statSync(path);
    if (s.isFile()) return path;
    if (s.isDirectory())
      return statSync(join(path, "index.html")).isFile() ? join(path, "index.html") : null;
  } catch {
    // Not found.
  }
  return null;
}

const SSR = process.argv.includes("--ssr");

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const p = url.pathname;
  // Same rule as the host: pages end in a slash.
  if (!p.endsWith("/") && extname(p) === "") {
    res.writeHead(308, { Location: `${p}/${url.search}` }).end();
    return;
  }
  if (SSR && isSsrPath(p)) {
    const page = await (await ssrHandler()).fetch(new Request(`http://localhost${p}`));
    res.writeHead(page.status, Object.fromEntries(page.headers));
    res.end(await page.text());
    return;
  }
  const file = fileFor(p);
  const status = file ? 200 : 404;
  const body = readFileSync(file ?? join(ROOT, "404.html"));
  res.writeHead(status, {
    "Content-Type": TYPES[extname(file ?? "404.html")] ?? "application/octet-stream",
  });
  res.end(body);
}).listen(Number(process.argv[2] ?? 4321));
