// @ts-nocheck: a content authoring helper, checked by the grader it calls.
// Why this exists: writes new drill files, content/drills/<fn>-drill-<n>.yaml,
// from a compact batch spec (an .mjs file whose default export is a list). The
// expected values and variant results come from the site's grader, and every
// accept and reject is graded before anything is written. Excel then checks
// them (docs/content.md, Drills). Only for new drills: it overwrites the file,
// so variants added later by tools/suggest-variants.ts would be lost.
// Usage: node tools/new-drills.ts <batch.mjs> [--write]
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildScreen, expectedLine, writeTask } from "./lib/build-screen.ts";

const REPO = ".";
const batch = (await import(pathToFileURL(resolve(process.argv[2] ?? "")).href)).default;
const write = process.argv.includes("--write");
const TODAY = "2026-11-17";

let problems = 0;
const usedNames = new Set();
for (const d of batch) {
  const id = `${d.fn.toLowerCase().replaceAll(".", "-")}-drill-${d.n}`;
  if (usedNames.has(id)) throw new Error(`duplicate ${id}`);
  usedNames.add(id);
  const built = buildScreen({ ...d, required: d.required ?? [d.fn] }, id, "drill");
  for (const p of built.problems) console.log(p);
  problems += built.problems.length;
  const file = {
    id,
    slug: id,
    level: d.level,
    title: d.title,
    updated: TODAY,
    checkedInExcel: null,
    function: d.fn,
    screens: [built.screen],
  };
  if (write) writeTask(`${REPO}/content/drills/${id}.yaml`, file);
  else console.log(expectedLine(id, built.screen));
}
console.log(
  problems ? `${problems} problems` : `ok, ${batch.length} drills${write ? " written" : ""}`,
);
process.exitCode = problems ? 1 : 0;
