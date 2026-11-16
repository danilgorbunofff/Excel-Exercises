// Why this exists: the Phase 2 runner. Prints, per screen, the result of the
// reverification steps 3 to 7: shape, expected value against Excel, every
// candidate formula judged by Excel and by the grader, feedback coverage and
// variants. Writes tools/audit/tasks-report.txt and tasks-findings.json.
// Usage: node tools/audit-tasks.ts [--only=<id>] [--kind=exercise|daily|mock] [--cached-only]
import { writeFileSync } from "node:fs";
import { grade } from "@practice/grader";
import {
  type Candidate,
  candidatesOf,
  excelMatches,
  type Judged,
  judgeCandidate,
  loadAuditFixture,
  loadTasks,
  localeSensitive,
  sheetsOf,
  specOf,
  staticIssues,
  strayNumbers,
  type TaskScreen,
} from "./lib/audit-tasks.ts";
import { type ExcelCase, type ExcelResult, runInExcel } from "./lib/excel-bridge.ts";

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ONLY = arg("only");
const KIND = arg("kind");
const CACHED_ONLY = process.argv.includes("--cached-only");
const CACHE = "tools/audit/excel-cache.json";

const tasks = loadTasks().filter((t) => (!ONLY || t.id === ONLY) && (!KIND || t.kind === KIND));
const plan = tasks.map((t) => {
  const fixture = loadAuditFixture(t);
  return { t, fixture, candidates: candidatesOf(t, fixture), sheets: sheetsOf(t.screen) };
});

// Excel settles what the grader accepts and every form meant to be right. A
// mutant or reject the grader already fails is graded only: Phase 1 showed the
// grader gives Excel's answer, and Excel adds little there at ~1 s a formula.
const needsExcel = (t: TaskScreen, c: Candidate) =>
  !(
    (c.source === "mutant" || c.source === "reject" || c.source === "audit-wrong") &&
    !grade(c.formula, specOf(t.screen)).correct
  );
const flags = plan.map(({ t, candidates }) => candidates.map((c) => needsExcel(t, c)));
const cases: ExcelCase[] = plan.flatMap(({ t, candidates, sheets }, p) =>
  candidates.flatMap((c, i) =>
    flags[p]?.[i]
      ? sheets.map((sh) => ({
          rows: sh.rows,
          formula: c.formula,
          cell: t.screen.answerCell,
          // Reference and accepted forms first, then fixtures, then mutants.
          priority: c.source === "mutant" ? 2 : c.source === "reject" ? 1 : 0,
        }))
      : [],
  ),
);
console.error(
  `${tasks.length} screens, ${cases.length} Excel evaluations (cached ones are skipped).`,
);
const fromExcel = runInExcel(cases, CACHE, { cacheOnly: CACHED_ONLY });

let k = 0;
const lines: string[] = [];
const findings: object[] = [];
const totals = { screens: 0, candidates: 0, ok: 0, issues: 0 };
const name = (t: TaskScreen) => `${t.kind}/${t.id}#${t.index + 1}`;

let graded = 0;
for (const [p, { t, fixture, candidates, sheets }] of plan.entries()) {
  totals.screens++;
  const s = t.screen;
  const judged: Judged[] = candidates.map((c, i) => {
    const ex = flags[p]?.[i]
      ? sheets.map(() => fromExcel[k++] as ExcelResult)
      : sheets.map(() => ({ value: null, invalid: "skipped" }));
    return judgeCandidate(t, c, ex);
  });
  graded += judged.filter((j) => j.excel[0]?.invalid === "skipped").length;
  // With --cached-only, a screen Excel has not finished yet is left out.
  if (judged.some((j) => j.excel.some((e) => e.invalid === "not cached"))) {
    totals.screens--;
    continue;
  }
  totals.candidates += judged.length;
  const problems: string[] = [
    ...staticIssues(
      s,
      (fixture.wrong ?? []).map((w) => w.formula),
    ).map((x) => `shape: ${x}`),
  ];

  // Step 3: the expected value (and each variant's) against Excel running the reference answer.
  const ref = judged.find((j) => j.candidate.source === "reference");
  sheets.forEach((sh, i) => {
    const r = ref?.excel[i];
    if (r && !excelMatches(r, sh.expected) && !localeSensitive(t, s.answer))
      problems.push(
        `expected: ${i ? `variant ${i}` : "base"} expects ${JSON.stringify(sh.expected)}, Excel gives ${JSON.stringify(r.invalid ?? r.value)}`,
      );
  });

  // Steps 4 to 6: every candidate, Excel against the grader.
  const equivalent = new Set((fixture.equivalent ?? []).map((e) => e.formula));
  for (const j of judged) {
    const c = j.candidate;
    const tag = `${c.source}${c.note ? ` (${c.note})` : ""}`;
    const rule = j.verdict.rule ?? "correct";
    if (j.outcome === "survivor" && equivalent.has(c.formula)) continue;
    if (j.outcome !== "ok") problems.push(`${j.outcome}: ${c.formula}  [${tag}] grader=${rule}`);
    // Fixtures must agree with Excel too: an accept Excel finds wrong, or a reject Excel finds right on every sheet.
    if (
      (c.source === "accept" || c.source === "audit-correct") &&
      !j.excelRight &&
      j.outcome !== "locale"
    )
      problems.push(
        `fixture: ${c.source} ${c.formula} is wrong in Excel (${JSON.stringify(j.excel.map((e) => e.invalid ?? e.value))})`,
      );
    if ((c.source === "reject" || c.source === "audit-wrong") && c.note !== rule)
      problems.push(`fixture: ${c.source} ${c.formula} names ${c.note}, grader says ${rule}`);
    if (
      (c.source === "reject" || c.source === "audit-wrong") &&
      j.excelRight &&
      (c.note === "value" || c.note === "fragile")
    )
      problems.push(
        `fixture: ${c.source} ${c.formula} expects ${c.note}, but Excel finds it right on every sheet`,
      );
  }

  // Step 8: feedback covers every rule a learner can hit, and quotes true numbers.
  // Rules the fixtures and the audit's wrong formulas reach must each have miss text.
  const rules = new Set(
    judged
      .filter(
        (j) =>
          !j.verdict.correct &&
          (j.candidate.source === "reject" || j.candidate.source === "audit-wrong"),
      )
      .map((j) => j.verdict.rule),
  );
  for (const r of rules) if (r && !s.misses[r]) problems.push(`misses: no text for rule ${r}`);
  if (s.variants && !s.misses.fragile) problems.push("misses: variants without fragile text");
  // Numbers the feedback derives (sums, shares, serials) are listed as notes; each was
  // checked by hand, so they are not problems.
  const notes: string[] = [];
  for (const [rule, text] of Object.entries(s.misses))
    for (const n of strayNumbers(text ?? "", t)) notes.push(`misses.${rule} quotes ${n}`);
  for (const [step, text] of Object.entries(s.hints))
    for (const n of strayNumbers(text, t)) notes.push(`hints.${step} quotes ${n}`);

  // Step 5: at least five different correct formulas, each right in Excel and accepted.
  const forms = judged.filter(
    (j) => j.candidate.source !== "mutant" && j.excelRight && j.verdict.correct,
  ).length;
  if (forms < 5) problems.push(`coverage: only ${forms} correct formulas checked in Excel`);

  // Step 7: level-3 screens need variants or a spill.
  if (t.level === 3 && !s.variants && !Array.isArray(s.expected))
    problems.push("level: level 3 without variants or a spill");

  const counts = judged.reduce<Record<string, number>>((acc, j) => {
    acc[j.candidate.source] = (acc[j.candidate.source] ?? 0) + 1;
    return acc;
  }, {});
  const right = judged.filter((j) => j.excelRight).length;
  lines.push(
    `${problems.length ? "!!" : "ok"} ${name(t)}  L${t.level}${t.tier ? ` T${t.tier}` : ""}  sheets=${sheets.length}  candidates=${judged.length} (Excel-right ${right})  ${Object.entries(
      counts,
    )
      .map(([a, b]) => `${a}:${b}`)
      .join(" ")}`,
  );
  for (const p of problems) lines.push(`   - ${p}`);
  if (notes.length) lines.push(`   note: derived numbers ${notes.join("; ")}`);
  if (problems.length) {
    totals.issues++;
    findings.push({ screen: name(t), file: t.file, problems });
  } else totals.ok++;
}

const summary = `${totals.screens} screens, ${totals.candidates} candidate formulas (${graded} graded only), ${totals.ok} clean, ${totals.issues} with problems.`;
lines.push("", summary);
if (!ONLY && !KIND && !CACHED_ONLY) {
  writeFileSync("tools/audit/tasks-report.txt", `${lines.join("\n")}\n`);
  writeFileSync("tools/audit/tasks-findings.json", `${JSON.stringify(findings, null, 1)}\n`);
}
console.log(ONLY || KIND || CACHED_ONLY ? lines.join("\n") : summary);
