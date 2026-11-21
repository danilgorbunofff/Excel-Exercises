// Why this exists: copy-lint sees content files and built HTML only. Strings that
// scripts inject, API errors, emails and grader messages never reach it, so this
// pulls the sentence-like string literals out of that code and lints them too.
// Read-only. Usage: node tools/copy-extract.ts [--list]
import { readFileSync } from "node:fs";
import { lintText } from "./lib/copy-lint.ts";
import { listFiles } from "./lib/fs.ts";

const ROOTS = ["src/scripts", "src/server", "src/pages/api", "src/lib", "packages/grader/src"];
const files = ROOTS.flatMap((r) =>
  listFiles(r, (n) => n.endsWith(".ts") && !n.endsWith(".test.ts") && !n.endsWith(".d.ts")),
);

// shortcut: regex, not a TS parser. Misses strings with nested quotes; upgrade to the TS compiler API if that bites.
const LITERAL = /"((?:[^"\\\n]|\\.){8,})"|'((?:[^'\\\n]|\\.){8,})'|`((?:[^`\\]|\\.){8,})`/gu;
// Prose: starts with a capital letter, has a space, and ends like a sentence.
const isProse = (s: string) =>
  /^[A-Z]/u.test(s) && /\s/u.test(s) && /[.?:]$|[a-z]$/u.test(s.trim());

let total = 0;
const list = process.argv.includes("--list");
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/u.test(line) || /\b(import|console\.(log|debug))\b/u.test(line)) return;
    for (const m of line.matchAll(LITERAL)) {
      const s = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/gu, "X");
      if (!isProse(s)) continue;
      const where = `${file}:${i + 1}`;
      if (list) console.log(`${where}\t${s}`);
      for (const issue of lintText(s, where)) {
        total++;
        console.error(`  ${issue.where} [${issue.rule}] ${issue.message}\n      "${issue.text}"`);
      }
    }
  });
}
console.log(`copy-extract: ${files.length} file(s), ${total} issue(s).`);
process.exitCode = total > 0 ? 1 : 0;
