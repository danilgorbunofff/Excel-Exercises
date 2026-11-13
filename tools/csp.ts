// Why this exists: keeps the Content-Security-Policy in vercel.json in step
// with the build. It hashes every inline script, style and style attribute in
// dist and fails if vercel.json does not list exactly those hashes, because a
// stale list blocks scripts and styles on the live site only.
// Run after `npm run build`: npm run check:csp, or npm run csp:write to update.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { buildPolicy, inlineHashes } from "./lib/csp.ts";
import { listFiles } from "./lib/fs.ts";

const CONFIG = "vercel.json";
const HEADER = "Content-Security-Policy";

if (!existsSync("dist")) {
  console.error("No dist folder. Run `npm run build` first.");
  process.exit(1);
}
// SVG files are served with the same header, and the favicon has a style element.
const files = listFiles("dist", (n) => n.endsWith(".html") || n.endsWith(".svg"));
const hashes = inlineHashes(files.map((f) => readFileSync(f, "utf8")));
const policy = buildPolicy(hashes);

const raw = readFileSync(CONFIG, "utf8");
const config = JSON.parse(raw) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const entry = config.headers
  .find((h) => h.source === "/(.*)")
  ?.headers.find((h) => h.key === HEADER);
if (!entry) {
  console.error(`${CONFIG} has no ${HEADER} header for "/(.*)".`);
  process.exit(1);
}

const counts = `${hashes.scripts.length} script(s), ${hashes.styles.length} style element(s), ${hashes.styleAttrs.length} style attribute(s)`;
if (process.argv.includes("--write")) {
  // Replace the old value in the text, so the rest of the file keeps its layout.
  writeFileSync(CONFIG, raw.replace(JSON.stringify(entry.value), JSON.stringify(policy)));
  console.log(`Wrote the ${HEADER} to ${CONFIG}: ${counts}.`);
} else if (entry.value !== policy) {
  console.error(`The ${HEADER} in ${CONFIG} does not match the build (${counts}).`);
  console.error(
    "Inline scripts or styles changed. Run `npm run csp:write` and commit vercel.json.",
  );
  process.exit(1);
} else {
  console.log(`CSP check passed: ${counts} in ${files.length} file(s).`);
}
