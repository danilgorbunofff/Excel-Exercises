// @ts-nocheck: a content authoring helper, checked by the grader it calls.
// Why this exists: writes ladder steps, content/steps/<parent>-step-<n>.yaml,
// from a compact batch spec (tools/step-specs/<track>.mjs, a default-exported
// list). Each entry is { parent, step, level, title, screens: [screen spec] },
// a screen spec as in tools/lib/build-screen.ts, with required: [] for none.
// Expected values come from the grader and every accept and reject is graded
// before anything is written. Excel then checks them (docs/content.md, Ladder
// steps). It overwrites the files it writes, so add later fixes to the spec.
// Usage: node tools/new-steps.ts <batch.mjs> [--write]
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildScreen, expectedLine, writeTask } from "./lib/build-screen.ts";

const batch = (await import(pathToFileURL(resolve(process.argv[2] ?? "")).href)).default;
const write = process.argv.includes("--write");
const TODAY = new Date().toISOString().slice(0, 10);

let problems = 0;
const used = new Set();
for (const d of batch) {
  const id = `${d.parent}-step-${d.step}`;
  if (used.has(id)) throw new Error(`duplicate ${id}`);
  used.add(id);
  const screens = d.screens.map((s, i) => {
    if (!Array.isArray(s.required)) throw new Error(`${id}#${i + 1}: set required, [] for none`);
    const built = buildScreen(s, `${id}#${i + 1}`, "task");
    for (const p of built.problems) console.log(p);
    problems += built.problems.length;
    return built.screen;
  });
  const file = {
    id,
    slug: id,
    level: d.level,
    title: d.title,
    updated: TODAY,
    checkedInExcel: null,
    parent: d.parent,
    step: d.step,
    screens,
  };
  if (write) writeTask(`content/steps/${id}.yaml`, file);
  else
    screens.forEach((s, i) => {
      console.log(expectedLine(`${id}#${i + 1}`, s));
    });
}
console.log(
  problems ? `${problems} problems` : `ok, ${batch.length} steps${write ? " written" : ""}`,
);
process.exitCode = problems ? 1 : 0;
