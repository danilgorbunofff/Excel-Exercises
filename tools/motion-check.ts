// Why this exists: the CI entry point for the reduced-motion rule. It scans the
// built CSS files and the inline styles of every page.
import { existsSync, readFileSync } from "node:fs";
import { listFiles } from "./lib/fs.ts";
import { findUnguardedMotion } from "./lib/motion.ts";

if (!existsSync("dist")) {
  console.error("No dist folder. Run `npm run build` first.");
  process.exit(1);
}
const sources: { file: string; css: string }[] = [];
for (const file of listFiles("dist", (n) => n.endsWith(".css"))) {
  sources.push({ file, css: readFileSync(file, "utf8") });
}
for (const file of listFiles("dist", (n) => n.endsWith(".html"))) {
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/giu))
    sources.push({ file, css: m[1] ?? "" });
  for (const m of html.matchAll(/\sstyle=(?:"([^"]*)"|'([^']*)')/giu)) {
    sources.push({ file, css: `x{${m[1] ?? m[2] ?? ""}}` });
  }
}
const findings = sources.flatMap(({ file, css }) =>
  findUnguardedMotion(css).map((f) => ({ file, ...f })),
);
if (findings.length > 0) {
  console.error("Motion outside @media (prefers-reduced-motion: no-preference):");
  for (const f of findings) console.error(`  ${f.file}: ${f.declaration}  (in ${f.context})`);
  process.exit(1);
}
console.log(`Reduced-motion check passed: ${sources.length} stylesheet(s) and style block(s).`);
