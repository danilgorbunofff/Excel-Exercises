// @ts-nocheck: a content authoring helper, checked by the grader it calls.
// Why this exists: writes new drill files, content/drills/<fn>-drill-<n>.yaml,
// from a compact batch spec (an .mjs file whose default export is a list). The
// expected values and variant results come from the site's grader, and every
// accept and reject is graded before anything is written. Excel then checks
// them (docs/content.md, Drills). Only for new drills: it overwrites the file,
// so variants added later by tools/suggest-variants.ts would be lost.
// Usage: node tools/new-drills.ts <batch.mjs> [--write]
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as G from "@practice/grader";
import YAML from "yaml";

const REPO = ".";
const batch = (await import(pathToFileURL(resolve(process.argv[2] ?? "")).href)).default;
const write = process.argv.includes("--write");
const TODAY = "2026-11-17";

const round = (v) => (typeof v === "number" ? Number(v.toPrecision(12)) : v);
function value(formula, rows, cell) {
  const grid = G.createGrid(rows);
  const v = G.evaluateFormula(formula, grid, G.parseAddress(cell));
  if (Array.isArray(v)) return v.map((r) => r.map(round));
  if (v && typeof v === "object" && "rows" in v) return v.rows.map((r) => r.map(round));
  if (G.isError(v)) throw new Error(`${formula} gives ${JSON.stringify(v)}`);
  return round(v ?? 0);
}
const withSet = (rows, set) =>
  rows.map((r, i) =>
    r.map((c, j) => {
      const a = `${G.columnLetters(j + 1)}${i + 1}`;
      return a in set ? set[a] : c;
    }),
  );

let problems = 0;
const usedNames = new Set();
for (const d of batch) {
  const id = `${d.fn.toLowerCase().replaceAll(".", "-")}-drill-${d.n}`;
  if (usedNames.has(id)) throw new Error(`duplicate ${id}`);
  usedNames.add(id);
  const expected = value(d.answer, d.rows, d.cell);
  const variants = (d.variants ?? []).map((set) => ({
    set,
    expected: value(d.answer, withSet(d.rows, set), d.cell),
  }));
  const required = d.required ?? [d.fn];
  const reject = [...(d.reject ?? []).map(([formula, rule]) => ({ formula, rule }))];
  // Always: a typed result and a broken bracket.
  if (!Array.isArray(expected) && typeof expected !== "boolean")
    reject.push({
      formula: typeof expected === "number" ? `=${expected}` : `="${expected}"`,
      rule: "required-function",
    });
  // A broken bracket, or a dangling comma when the formula does not end in one.
  reject.push({
    formula: d.answer.endsWith(")") ? d.answer.slice(0, -1) : `${d.answer},`,
    rule: "syntax",
  });
  const misses = {
    // A function gets the expected value, so the miss text quotes the grader's own result.
    value: typeof d.value === "function" ? d.value(expected) : d.value,
    syntax: "Check the brackets, commas and quotes.",
  };
  if (reject.some((r) => r.rule === "reference"))
    misses.reference = "Point at the cells, so the result follows the data when it changes.";
  const words =
    required.length <= 1
      ? required.join("")
      : `${required.slice(0, -1).join(", ")} and ${required.at(-1)}`;
  if (reject.some((r) => r.rule === "required-function"))
    misses["required-function"] = `This drill asks for ${words}.`;
  if (reject.some((r) => r.rule === "forbidden-function"))
    misses["forbidden-function"] = d.forbiddenMiss;
  if (variants.length > 0 || reject.some((r) => r.rule === "fragile"))
    misses.fragile =
      "The data can change, so the formula has to work the result out from the cells, not from values you can see.";
  const screen = {
    prompt: d.prompt,
    rows: d.rows,
    answerCell: d.cell,
    expected,
    ...(variants.length ? { variants } : {}),
    answer: d.answer,
    requiredFunctions: required,
    ...(d.forbidden ? { forbiddenFunctions: d.forbidden } : {}),
    hints: { nudge: d.nudge, rule: d.rule },
    misses,
    accept: [d.answer, ...(d.accept ?? [])],
    reject,
  };
  const spec = {
    rows: screen.rows,
    answerCell: screen.answerCell,
    expected: screen.expected,
    requiredFunctions: required,
    forbiddenFunctions: d.forbidden ?? [],
    requireReference: true,
    ...(variants.length ? { variants } : {}),
  };
  for (const f of screen.accept) {
    const v = G.grade(f, spec);
    if (!v.correct) {
      problems++;
      console.log(`${id}: accept ${f} -> ${v.rule}: ${v.message}`);
    }
  }
  for (const r of reject) {
    const v = G.grade(r.formula, spec);
    if (v.correct || v.rule !== r.rule) {
      problems++;
      console.log(
        `${id}: reject ${r.formula} -> ${v.correct ? "correct" : v.rule}, wanted ${r.rule}`,
      );
    }
  }
  const file = {
    id,
    slug: id,
    level: d.level,
    title: d.title,
    updated: TODAY,
    checkedInExcel: null,
    function: d.fn,
    screens: [screen],
  };
  if (write) {
    const doc = new YAML.Document(file);
    // Astro's YAML loader reads unquoted 2026-11-17 as a date, so quote date-like text in the screens.
    YAML.visit(doc.get("screens"), {
      Scalar(_, node) {
        if (typeof node.value === "string" && /^\d{4}-\d{2}-\d{2}/u.test(node.value))
          node.type = "QUOTE_DOUBLE";
      },
    });
    const sc = doc.getIn(["screens", 0]);
    for (const row of sc.get("rows").items) row.flow = true;
    for (const v of sc.get("variants")?.items ?? []) v.get("set").flow = true;
    const exp = sc.get("expected");
    if (exp && typeof exp === "object" && "items" in exp)
      for (const row of exp.items) row.flow = true;
    writeFileSync(
      `${REPO}/content/drills/${id}.yaml`,
      doc.toString({ lineWidth: 0, flowCollectionPadding: false }),
    );
  } else
    console.log(
      `${id}: expected ${JSON.stringify(expected)}${variants.length ? ` variants ${JSON.stringify(variants.map((v) => v.expected))}` : ""}`,
    );
}
console.log(
  problems ? `${problems} problems` : `ok, ${batch.length} drills${write ? " written" : ""}`,
);
process.exitCode = problems ? 1 : 0;
