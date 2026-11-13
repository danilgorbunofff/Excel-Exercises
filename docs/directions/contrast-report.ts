// Why this exists: prints the measured contrast of every token pair in every
// direction and theme, and exits non-zero if any pair is under its minimum.
import { writeFileSync } from "node:fs";
import { contrastRatio } from "../../tools/lib/contrast.ts";
import { DIRECTIONS, PAIRS } from "./tokens.ts";

let failures = 0;
const lines: string[] = [];
for (const d of DIRECTIONS) {
  lines.push(`\n### ${d.name}\n`, "| Pair | Use | Min | Light | Dark |", "|---|---|---|---|---|");
  for (const p of PAIRS) {
    const light = contrastRatio(d.light[p.fg], d.light[p.bg]);
    const dark = contrastRatio(d.dark[p.fg], d.dark[p.bg]);
    const mark = (r: number) => `${r.toFixed(2)}${r < p.min ? " FAIL" : ""}`;
    if (light < p.min || dark < p.min) failures++;
    lines.push(`| ${p.fg} on ${p.bg} | ${p.use} | ${p.min} | ${mark(light)} | ${mark(dark)} |`);
  }
}
writeFileSync(
  "docs/directions/contrast.md",
  `# Measured contrast\n\nWCAG 2 ratios computed from \`docs/directions/tokens.ts\` by \`tools/lib/contrast.ts\`.\n${lines.join("\n")}\n`,
);
console.log(lines.filter((l) => l.includes("FAIL") || l.startsWith("\n###")).join("\n"));
console.log(failures ? `${failures} pair(s) under the minimum` : "All pairs meet their minimum.");
process.exit(failures ? 1 : 0);
