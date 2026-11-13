// Why this exists: the CI entry point for the copy rules. It lints the prose in
// content files and every built HTML page, so nothing reaches a visitor unchecked.
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { type CopyIssue, lintHtml, lintYamlStrings } from "./lib/copy-lint.ts";
import { listFiles } from "./lib/fs.ts";

if (!existsSync("dist/client")) {
  console.error("No dist folder. Run `npm run build` first.");
  process.exit(1);
}
const yamlFiles = listFiles("content", (n) => n.endsWith(".yaml"));
const htmlFiles = listFiles("dist/client", (n) => n.endsWith(".html"));
const issues: CopyIssue[] = [
  ...yamlFiles.flatMap((f) => lintYamlStrings(parse(readFileSync(f, "utf8")), f)),
  ...htmlFiles.flatMap((f) => lintHtml(readFileSync(f, "utf8"), f)),
];

if (issues.length > 0) {
  console.error(`Copy lint found ${issues.length} problem(s):`);
  for (const i of issues) console.error(`  ${i.where} [${i.rule}] ${i.message}\n      "${i.text}"`);
  process.exit(1);
}
console.log(`Copy lint passed: ${yamlFiles.length} content file(s), ${htmlFiles.length} page(s).`);
