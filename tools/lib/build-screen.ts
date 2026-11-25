// @ts-nocheck: a content authoring helper, checked by the grader it calls.
// Why this exists: turns one compact task spec into a screen the schema takes,
// with the expected values and variant results from the site's grader, and
// grades every accept and reject before anything is written. Shared by
// tools/new-drills.ts and tools/new-steps.ts.
import { writeFileSync } from "node:fs";
import * as G from "@practice/grader";
import YAML from "yaml";

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

/**
 * d: { prompt, rows, cell, answer, nudge, rule, value, required?, accept?,
 * reject?: [formula, rule][], variants?, forbidden?, forbiddenMiss? }.
 * asks: the words after "This ... asks for", e.g. "drill" or "task".
 * Returns the screen and a line per accept or reject the grader disagrees with.
 */
export function buildScreen(d, id, asks) {
  const problems = [];
  const expected = value(d.answer, d.rows, d.cell);
  const variants = (d.variants ?? []).map((set) => ({
    set,
    expected: value(d.answer, withSet(d.rows, set), d.cell),
  }));
  const required = d.required;
  const reject = [...(d.reject ?? []).map(([formula, rule]) => ({ formula, rule }))];
  // Always: a typed result and a broken bracket. With no required function, the typed result is a missing reference.
  if (!Array.isArray(expected) && typeof expected !== "boolean")
    reject.push({
      formula: typeof expected === "number" ? `=${expected}` : `="${expected}"`,
      rule: required.length > 0 ? "required-function" : "reference",
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
    misses["required-function"] = `This ${asks} asks for ${words}.`;
  if (reject.some((r) => r.rule === "forbidden-function"))
    misses["forbidden-function"] = d.forbiddenMiss;
  if (variants.length > 0 || reject.some((r) => r.rule === "fragile"))
    misses.fragile =
      "The data can change, so the formula must calculate the result from the cells. A typed value, or a formula that is right by chance, will not follow the change.";
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
    if (!v.correct) problems.push(`${id}: accept ${f} -> ${v.rule}: ${v.message}`);
  }
  for (const r of reject) {
    const v = G.grade(r.formula, spec);
    if (v.correct || v.rule !== r.rule)
      problems.push(
        `${id}: reject ${r.formula} -> ${v.correct ? "correct" : v.rule}, wanted ${r.rule}`,
      );
  }
  return { screen, problems };
}

/** The dry-run line for a screen: its expected value and variant results. */
export const expectedLine = (id, s) =>
  `${id}: expected ${JSON.stringify(s.expected)}${s.variants ? ` variants ${JSON.stringify(s.variants.map((v) => v.expected))}` : ""}`;

/** Writes a task file with rows, variant sets and spilled results on one line each. */
export function writeTask(path, file) {
  const doc = new YAML.Document(file);
  // Astro's YAML loader reads unquoted 2026-11-17 as a date, so quote date-like text in the screens.
  YAML.visit(doc.get("screens"), {
    Scalar(_, node) {
      if (typeof node.value === "string" && /^\d{4}-\d{2}-\d{2}/u.test(node.value))
        node.type = "QUOTE_DOUBLE";
    },
  });
  for (const sc of doc.get("screens").items) {
    for (const row of sc.get("rows").items) row.flow = true;
    for (const v of sc.get("variants")?.items ?? []) v.get("set").flow = true;
    const exp = sc.get("expected");
    if (exp && typeof exp === "object" && "items" in exp)
      for (const row of exp.items) row.flow = true;
  }
  writeFileSync(path, doc.toString({ lineWidth: 0, flowCollectionPadding: false }));
}
