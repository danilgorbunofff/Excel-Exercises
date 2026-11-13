// Why this exists: a production build must not point canonical links, share
// tags, the sitemap or robots.txt at example.com or a local address. CI runs
// this after the build on pushes to main, so the placeholder origin in
// site.config.ts cannot reach the live site unnoticed.
// Run after `npm run build`: npm run check:origin
import { existsSync, readFileSync } from "node:fs";
import { listFiles } from "./lib/fs.ts";
import { emittedUrls, isPlaceholderUrl } from "./lib/origin.ts";

if (!existsSync("dist/client")) {
  console.error("No dist folder. Run `npm run build` first.");
  process.exit(1);
}

const files = listFiles("dist/client", (n) => /\.(html|xml|txt)$/u.test(n));
let seen = 0;
const wrong: string[] = [];
for (const file of files) {
  for (const { kind, url } of emittedUrls(readFileSync(file, "utf8"))) {
    seen += 1;
    if (isPlaceholderUrl(url)) wrong.push(`  ${file}: ${kind} ${url}`);
  }
}

if (seen === 0) {
  console.error("Origin check found no canonical links, share tags or sitemap entries in dist.");
  process.exit(1);
}
if (wrong.length > 0) {
  console.error(`Origin check: ${wrong.length} of ${seen} URLs use a placeholder or local origin:`);
  for (const line of wrong.slice(0, 20)) console.error(line);
  if (wrong.length > 20) console.error(`  and ${wrong.length - 20} more`);
  console.error("Set url in site.config.ts to the live domain and build again.");
  process.exit(1);
}
console.log(`Origin check passed: ${seen} URLs in ${files.length} file(s).`);
