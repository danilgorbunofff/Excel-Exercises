// Why this exists: Phase 1 of the reverification. Runs every case in
// tools/audit/grader-cases.ts through the grader and through Excel, prints
// each difference, and writes tools/audit/grader-excel.json for the parity
// test. Excel answers come from tools/audit/excel-cache.json when cached.
// Usage: node tools/audit-grader.ts [--area=<name>]
import { writeFileSync } from "node:fs";
import { createGrid, evaluateFormula, grade, parseAddress } from "@practice/grader";
import { CASES, CELL, SHEET, SYNTAX_CASES } from "./audit/grader-cases.ts";
import { type ExcelScalar, runInExcel } from "./lib/excel-bridge.ts";
import { sameExcel, toExcelShape } from "./lib/excel-compare.ts";

const AREA = process.argv.find((a) => a.startsWith("--area="))?.slice(7);
const CACHE = "tools/audit/excel-cache.json";
const cases = CASES.filter((c) => (!AREA || c.area === AREA) && !c.skip);
const skipped = CASES.filter((c) => c.skip);
const grid = createGrid(SHEET);
const at = parseAddress(CELL);
if (!at) throw new Error(CELL);

const excel = runInExcel(
  cases.map((c) => ({ rows: SHEET, formula: c.formula, cell: CELL })),
  CACHE,
);
const rows = cases.map((c, i) => {
  let ours: ReturnType<typeof toExcelShape> | { crash: string };
  try {
    ours = toExcelShape(evaluateFormula(c.formula, grid, at));
  } catch (e) {
    ours = { crash: String(e) };
  }
  const theirs = excel[i]?.value as ExcelScalar | ExcelScalar[][];
  return {
    ...c,
    excel: theirs,
    grader: ours,
    match: !("crash" in Object(ours)) && sameExcel(ours as ReturnType<typeof toExcelShape>, theirs),
  };
});

const show = (v: unknown) => JSON.stringify(v);
let bad = 0;
for (const r of rows) {
  if (r.match) continue;
  bad++;
  console.log(
    `${r.locale ? "LOCALE " : "DIFF   "}[${r.area}] ${r.formula}\n  excel  ${show(r.excel)}\n  grader ${show(r.grader)}`,
  );
}

// Syntax: Excel refuses the formula (or rewrites it); the grader should say syntax.
const spec = {
  rows: SHEET,
  answerCell: CELL,
  expected: 0,
  requiredFunctions: [],
  forbiddenFunctions: [],
  requireReference: false,
};
const syntaxExcel = runInExcel(
  SYNTAX_CASES.map((formula) => ({ rows: SHEET, formula, cell: CELL, readFormula: true })),
  CACHE,
);
const syntax = SYNTAX_CASES.map((formula, i) => {
  let v: { rule: string | null; message: string };
  try {
    v = grade(formula, spec);
  } catch (e) {
    v = { rule: "CRASH", message: String(e) };
  }
  return {
    formula,
    excel: syntaxExcel[i]?.invalid
      ? "refused"
      : `${show(syntaxExcel[i]?.value)} stored ${syntaxExcel[i]?.formula}`,
    rule: v.rule,
    message: v.message,
  };
});
for (const s of syntax)
  console.log(`SYNTAX ${s.formula}  excel=${s.excel}  grader=${s.rule}: ${s.message}`);

writeFileSync(
  "tools/audit/grader-excel.json",
  `${JSON.stringify(
    rows.map(({ area, formula, locale, excel: e, match }) => ({
      area,
      formula,
      locale,
      excel: e,
      match,
    })),
    null,
    1,
  )}\n`,
);
for (const c of skipped) console.log(`SKIPPED ${c.formula}: ${c.skip}`);
console.log(
  `\n${rows.length} cases, ${bad} differ (${rows.filter((r) => !r.match && r.locale).length} locale-sensitive).`,
);
