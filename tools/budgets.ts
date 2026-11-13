// Why this exists: the CI entry point for the size budgets. It measures every
// built page and fails if any page goes over a budget.
import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { BUDGETS, measurePage } from "./lib/budgets.ts";
import { listFiles } from "./lib/fs.ts";

const DIST = "dist/client";
if (!existsSync(DIST)) {
  console.error("No dist folder. Run `npm run build` first.");
  process.exit(1);
}
const read = (path: string) => {
  const file = join(DIST, path);
  return existsSync(file) ? readFileSync(file) : undefined;
};
const routeOf = (file: string) =>
  `/${relative(DIST, file).split(sep).join("/")}`.replace(/index\.html$/u, "");
const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`;

let failed = false;
console.log(
  `Budgets: first paint ${kb(BUDGETS.firstPaintBytes)}, JS ${kb(BUDGETS.jsBytes)} (gzipped)`,
);
for (const file of listFiles(DIST, (n) => n.endsWith(".html"))) {
  const m = measurePage(readFileSync(file, "utf8"), routeOf(file), read);
  const over = m.firstPaintBytes > BUDGETS.firstPaintBytes || m.jsBytes > BUDGETS.jsBytes;
  if (over || m.missing.length > 0) failed = true;
  console.log(
    `  ${over ? "OVER" : "ok  "} ${m.route.padEnd(32)} first paint ${kb(m.firstPaintBytes).padStart(8)}  JS ${kb(m.jsBytes).padStart(8)} (${m.jsFiles.length} file(s))`,
  );
  for (const path of m.missing) console.log(`       missing asset: ${path}`);
}
if (failed) process.exit(1);
