// Why this exists: Phase 2 proof that runs without Excel. For each screen it
// writes tools/audit/formulas/<kind>/<id>.yaml from the Excel cache:
//   correct     other ways to write the answer that Excel finds right everywhere;
//   wrong       mutants Excel finds wrong on the sheet or a variant, with the rule the grader gives;
//   equivalent  mutants Excel finds right everywhere, with why that is fair here.
// src/content/audit-fixtures.test.ts replays them in `npm run test`. Mutants
// that the grader rejects but that Excel has not yet seen on every sheet are
// sent to Excel first, so each wrong entry carries Excel's evidence.
// Usage: node tools/write-audit-fixtures.ts (Excel must be running for new sheets)
import { mkdirSync, writeFileSync } from "node:fs";
import { stringify } from "yaml";
import {
  type AuditScreen,
  candidatesOf,
  judgeCandidate,
  loadTasks,
  sheetsOf,
  type TaskScreen,
} from "./lib/audit-tasks.ts";
import { type ExcelCase, runInExcel } from "./lib/excel-bridge.ts";

const CACHE = "tools/audit/excel-cache.json";

const WHY: [RegExp, string][] = [
  [
    /one row long|one row short|skips its first row|one column (right|left)/u,
    "The cells it adds or drops hold nothing that changes the result here, so Excel gives the same answer on the sheet and every variant.",
  ],
  [
    /ROUNDUP|ROUNDDOWN/u,
    "The inputs leave no extra decimals to round, so Excel gives the same answer on the sheet and every variant.",
  ],
  [
    /without FALSE|FALSE written as TRUE/u,
    "The table is sorted and the answer already matches approximately, so Excel gives the same answer here.",
  ],
  [/SEARCH instead of FIND/u, "A hyphen has no case, so SEARCH and FIND agree."],
];
const why = (note: string) =>
  WHY.find(([re]) => re.test(note))?.[1] ??
  "Excel gives the same answer on the sheet and every variant, and no realistic change to the data tells it apart (reviewed).";

const tasks = loadTasks();
const sheetCases = (t: TaskScreen, formula: string): ExcelCase[] =>
  sheetsOf(t.screen).map((sh) => ({ rows: sh.rows, formula, cell: t.screen.answerCell }));

// First pass: mutants Excel has seen on the base sheet but not on every variant.
const missing: ExcelCase[] = [];
for (const t of tasks)
  for (const c of candidatesOf(t)) {
    if (c.source !== "mutant") continue;
    const cases = sheetCases(t, c.formula);
    const got = runInExcel(cases, CACHE, { cacheOnly: true });
    if (got[0]?.invalid !== "not cached" && got.some((g) => g.invalid === "not cached"))
      missing.push(...cases.filter((_, i) => got[i]?.invalid === "not cached"));
  }
if (missing.length) {
  console.log(`sending ${missing.length} variant sheets to Excel`);
  runInExcel(missing, CACHE);
}

const files = new Map<string, { kind: string; screens: AuditScreen[] }>();
let counts = { correct: 0, wrong: 0, equivalent: 0 };
for (const t of tasks) {
  const screen: AuditScreen = { correct: [], wrong: [], equivalent: [] };
  for (const c of candidatesOf(t)) {
    if (c.source === "reference" || c.source === "accept" || c.source === "reject") continue;
    const excel = runInExcel(sheetCases(t, c.formula), CACHE, { cacheOnly: true });
    if (excel.some((e) => e.invalid === "not cached")) continue;
    const j = judgeCandidate(t, c, excel);
    if (j.excelRefused || j.outcome === "locale") continue;
    if (c.source !== "mutant" && j.excelRight && j.verdict.correct) screen.correct?.push(c.formula);
    else if (c.source === "mutant" && !j.excelRight && !j.verdict.correct && j.verdict.rule)
      screen.wrong?.push({ formula: c.formula, rule: j.verdict.rule, why: c.note });
    else if (c.source === "mutant" && j.excelRight && j.verdict.correct)
      screen.equivalent?.push({ formula: c.formula, why: `${c.note}: ${why(c.note)}` });
  }
  screen.correct = [...new Set(screen.correct)];
  const key = `tools/audit/formulas/${t.kind}/${t.id}.yaml`;
  const file = files.get(key) ?? { kind: t.kind, screens: [] };
  file.screens[t.index] = screen;
  files.set(key, file);
  counts = {
    correct: counts.correct + (screen.correct?.length ?? 0),
    wrong: counts.wrong + (screen.wrong?.length ?? 0),
    equivalent: counts.equivalent + (screen.equivalent?.length ?? 0),
  };
}
for (const [path, { kind, screens }] of files) {
  mkdirSync(`tools/audit/formulas/${kind}`, { recursive: true });
  writeFileSync(
    path,
    `# Written by tools/write-audit-fixtures.ts from Excel results; replayed by src/content/audit-fixtures.test.ts.\n${stringify({ screens }, { lineWidth: 0 })}`,
  );
}
console.log(
  `${files.size} files: ${counts.correct} correct, ${counts.wrong} wrong, ${counts.equivalent} equivalent`,
);
