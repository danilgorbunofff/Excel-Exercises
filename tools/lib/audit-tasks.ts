// Why this exists: Phase 2 of the reverification. For every screen of every
// track exercise, daily task and mock task it builds candidate formulas
// (accepted and rejected fixtures, the audit's own lists, mechanical restyles,
// rewrites into other function families, and mutants of the reference
// answer), asks Excel whether each one is right on the sheet and on every
// variant, and compares that with the grader's verdict. Excel is the oracle:
// a formula Excel finds right must pass unless a stated rule forbids it, and
// one Excel finds wrong must fail.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  type CellInput,
  type Expected,
  type GradeSpec,
  grade,
  type Node,
  parse,
  parseAddress,
  type Verdict,
  walkAst,
} from "@practice/grader";
import { parse as parseYaml } from "yaml";
import {
  dailySchema,
  drillSchema,
  exerciseSchema,
  mockSchema,
  type Screen,
} from "../../src/content/schema.ts";
import type { ExcelResult, ExcelScalar } from "./excel-bridge.ts";

export type Kind = "exercise" | "daily" | "mock" | "drill";

export interface TaskScreen {
  kind: Kind;
  id: string;
  file: string;
  level: number;
  tier?: number | undefined;
  index: number;
  title?: string | undefined;
  screen: Screen;
}

const DIRS: [Kind, string][] = [
  ["exercise", "content/exercises"],
  ["daily", "content/daily"],
  ["mock", "content/mocks"],
  ["drill", "content/drills"],
];

const SCHEMAS = {
  exercise: exerciseSchema,
  daily: dailySchema,
  mock: mockSchema,
  drill: drillSchema,
} as const;

export function loadTasks(root = "."): TaskScreen[] {
  const out: TaskScreen[] = [];
  for (const [kind, dir] of DIRS) {
    const schema = SCHEMAS[kind];
    for (const f of readdirSync(`${root}/${dir}`)
      .filter((n) => n.endsWith(".yaml"))
      .sort()) {
      const e = schema.parse(parseYaml(readFileSync(`${root}/${dir}/${f}`, "utf8"))) as {
        id: string;
        title?: string;
        level: number;
        tier?: number;
        screens: Screen[];
      };
      e.screens.forEach((screen, index) => {
        out.push({
          kind,
          id: e.id,
          file: `${dir}/${f}`,
          level: e.level,
          tier: e.tier,
          index,
          title: e.title,
          screen,
        });
      });
    }
  }
  return out;
}

export const specOf = (s: Screen): GradeSpec => ({
  rows: s.rows,
  answerCell: s.answerCell,
  expected: s.expected,
  requiredFunctions: s.requiredFunctions,
  forbiddenFunctions: s.forbiddenFunctions,
  requireReference: s.requireReference,
  ...(s.variants ? { variants: s.variants } : {}),
});

/** The sheet with some cells changed, growing it where needed, as the grader does. */
export function patch(
  rows: readonly (readonly CellInput[])[],
  set: Readonly<Record<string, CellInput>>,
): CellInput[][] {
  const out = rows.map((r) => [...r]);
  for (const [address, value] of Object.entries(set)) {
    const at = parseAddress(address);
    if (!at) throw new Error(`Invalid cell: ${address}`);
    while (out.length < at.row) out.push([]);
    const row = out[at.row - 1] as CellInput[];
    while (row.length < at.col) row.push(null);
    row[at.col - 1] = value;
  }
  return out;
}

/** The base sheet and each variant, with the result each must give. */
export const sheetsOf = (s: Screen): { rows: CellInput[][]; expected: Expected }[] => [
  { rows: s.rows.map((r) => [...r]), expected: s.expected },
  ...(s.variants ?? []).map((v) => ({ rows: patch(s.rows, v.set), expected: v.expected })),
];

/** Shape problems a learner would trip over before writing anything. */
export function staticIssues(s: Screen, auditWrong: readonly string[] = []): string[] {
  const issues: string[] = [];
  const width = Math.max(0, ...s.rows.map((r) => r.length));
  if (s.rows.some((r) => r.length !== width)) issues.push("grid is not rectangular");
  const at = parseAddress(s.answerCell);
  if (!at) return [...issues, `bad answer cell ${s.answerCell}`];
  if (at.row > s.rows.length || at.col > width)
    issues.push(`answer cell ${s.answerCell} is outside the grid`);
  else if (s.rows[at.row - 1]?.[at.col - 1] !== null)
    issues.push(`answer cell ${s.answerCell} is not empty`);
  for (const [i, sheet] of sheetsOf(s).entries()) {
    if (!Array.isArray(sheet.expected)) continue;
    const h = sheet.expected.length;
    const w = sheet.expected[0]?.length ?? 0;
    if (sheet.expected.some((r) => r.length !== w)) issues.push(`expected block ${i} is ragged`);
    if (at.row + h - 1 > s.rows.length || at.col + w - 1 > width)
      issues.push(`spill block ${i} (${h}x${w}) runs past the grid`);
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++)
        if ((r || c) && (sheet.rows[at.row - 1 + r]?.[at.col - 1 + c] ?? null) !== null)
          issues.push(`spill block ${i} covers a filled cell`);
  }
  (s.variants ?? []).forEach((v, i) => {
    for (const a of Object.keys(v.set)) {
      const p = parseAddress(a);
      if (p && (p.row > s.rows.length || p.col > width))
        issues.push(`variant ${i + 1} sets ${a}, outside the grid`);
      if (a === s.answerCell) issues.push(`variant ${i + 1} sets the answer cell`);
    }
    // A variant with the base result earns its place only when it is the one that
    // catches a rejected formula the base data lets through.
    const catches = [...s.reject.map((r) => r.formula), ...auditWrong].some(
      (f) =>
        grade(f, { ...specOf(s), variants: [] }).correct &&
        !grade(f, { ...specOf(s), variants: [v] }).correct,
    );
    if (JSON.stringify(v.expected) === JSON.stringify(s.expected) && !catches)
      issues.push(`variant ${i + 1} does not change the expected result`);
  });
  return issues;
}

// ---------------------------------------------------------------- candidates

export type Source =
  | "reference"
  | "accept"
  | "reject"
  | "audit-correct"
  | "audit-wrong"
  | "restyle"
  | "rewrite"
  | "mutant";

export interface Candidate {
  formula: string;
  source: Source;
  /** What the mutant or rewrite did, or the rule a reject names. */
  note: string;
}

const splice = (f: string, start: number, end: number, text: string) =>
  f.slice(0, start) + text + f.slice(end);

function nodesOf(formula: string): Node[] {
  const p = parse(formula);
  if (!p.ok) return [];
  const all: Node[] = [];
  walkAst(p.ast, (n) => all.push(n));
  return all;
}

const COL = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/u;
const letters = (n: number) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26))
    s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};
const colNum = (l: string) =>
  [...l.toUpperCase()].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);

function moveRef(text: string, dRow: number, dCol: number): string | null {
  const m = COL.exec(text);
  if (!m) return null;
  const row = Number(m[4]) + dRow;
  const col = colNum(m[2] as string) + dCol;
  if (row < 1 || col < 1) return null;
  return `${m[1]}${letters(col)}${m[3]}${row}`;
}

/** Same formula with every reference made absolute, then in lower case with spaces. */
export function restyles(formula: string): Candidate[] {
  const nodes = nodesOf(formula).filter((n) => n.type === "ref" || n.type === "range");
  let anchored = formula;
  for (const n of [...nodes].sort((a, b) => b.start - a.start)) {
    const text = formula.slice(n.start, n.end).replace(/\$?([A-Za-z]{1,3})\$?(\d+)/gu, "$$$1$$$2");
    anchored = splice(anchored, n.start, n.end, text);
  }
  // Lower case outside strings, a space after each comma and around operators.
  let spaced = "";
  let inString = false;
  for (const ch of formula) {
    if (ch === '"') inString = !inString;
    spaced += inString || ch === '"' ? ch : ch === "," ? ", " : ch.toLowerCase();
  }
  const out: Candidate[] = [];
  if (anchored !== formula)
    out.push({ formula: anchored, source: "restyle", note: "absolute references" });
  if (nodes.length && nodes[0]) {
    const first = nodes[0];
    const mixed = splice(
      formula,
      first.start,
      first.end,
      formula.slice(first.start, first.end).replace(/([A-Za-z]{1,3})(\d+)/gu, "$1$$$2"),
    );
    if (mixed !== formula)
      out.push({ formula: mixed, source: "restyle", note: "mixed references" });
  }
  if (spaced !== formula)
    out.push({ formula: spaced, source: "restyle", note: "lower case and spaces" });
  return out;
}

const SWAP_OP: Record<string, string[]> = {
  ">": [">="],
  ">=": [">"],
  "<": ["<="],
  "<=": ["<"],
  "=": ["<>"],
  "<>": ["="],
};
const SWAP_FN: Record<string, string[]> = {
  MIN: ["MAX"],
  MAX: ["MIN"],
  LARGE: ["SMALL"],
  SMALL: ["LARGE"],
  LEFT: ["RIGHT"],
  RIGHT: ["LEFT"],
  ROUNDUP: ["ROUNDDOWN", "ROUND"],
  ROUNDDOWN: ["ROUNDUP", "ROUND"],
  ROUND: ["ROUNDDOWN", "ROUNDUP"],
  AND: ["OR"],
  OR: ["AND"],
  COUNT: ["COUNTA"],
  COUNTA: ["COUNT"],
  SUM: ["AVERAGE"],
  AVERAGE: ["SUM", "MEDIAN"],
  SUMIF: ["COUNTIF", "AVERAGEIF"],
  SUMIFS: ["AVERAGEIFS"],
  FIND: ["SEARCH"],
  SEARCH: ["FIND"],
  IFERROR: ["IFNA"],
  MEDIAN: ["AVERAGE"],
  EOMONTH: ["EDATE"],
  EDATE: ["EOMONTH"],
  FLOOR: ["CEILING"],
  CEILING: ["FLOOR"],
};
/** Wrappers whose removal is a classic slip: no cleaning, no conversion. */
const UNWRAP = new Set([
  "TRIM",
  "VALUE",
  "UPPER",
  "LOWER",
  "PROPER",
  "ABS",
  "INT",
  "IFERROR",
  "IFNA",
  "UNIQUE",
  "SORT",
  "CLEAN",
]);

/** Mutants of a correct formula: each is one common slip. Excel decides which are really wrong. */
export function mutants(formula: string, s: Screen): Candidate[] {
  const out: Candidate[] = [];
  const add = (f: string, note: string) => {
    if (f !== formula) out.push({ formula: f, source: "mutant", note });
  };
  const p = parse(formula);
  if (!p.ok) return out;
  const nodes = nodesOf(formula);
  for (const n of nodes) {
    const text = formula.slice(n.start, n.end);
    if (n.type === "range") {
      const [a, b] = text.split(":");
      if (!a || !b || !COL.test(a) || !COL.test(b)) continue;
      const r1 = Number(COL.exec(a)?.[4]);
      const r2 = Number(COL.exec(b)?.[4]);
      if (r2 > r1)
        add(
          splice(formula, n.start, n.end, `${a}:${moveRef(b, -1, 0)}`),
          `range ${text} one row short at the end`,
        );
      if (r2 > r1)
        add(
          splice(formula, n.start, n.end, `${moveRef(a, 1, 0)}:${b}`),
          `range ${text} skips its first row`,
        );
      // A range run on past the data reads only empty cells: the same formula, not a slip.
      if (r2 < s.rows.length)
        add(
          splice(formula, n.start, n.end, `${a}:${moveRef(b, 1, 0)}`),
          `range ${text} one row long`,
        );
      const c1 = moveRef(a, 0, 1);
      const c2 = moveRef(b, 0, 1);
      if (c1 && c2)
        add(splice(formula, n.start, n.end, `${c1}:${c2}`), `range ${text} one column right`);
      const l1 = moveRef(a, 0, -1);
      const l2 = moveRef(b, 0, -1);
      if (l1 && l2)
        add(splice(formula, n.start, n.end, `${l1}:${l2}`), `range ${text} one column left`);
    } else if (n.type === "ref") {
      for (const [dr, dc, what] of [
        [1, 0, "next row"],
        [-1, 0, "row above"],
        [0, 1, "next column"],
        [0, -1, "column to the left"],
      ] as const) {
        const moved = moveRef(text, dr, dc);
        if (moved) add(splice(formula, n.start, n.end, moved), `${text} read from the ${what}`);
      }
    } else if (n.type === "binary" && SWAP_OP[n.op]) {
      const opAt = formula.indexOf(n.op, n.left.end);
      for (const op of SWAP_OP[n.op] ?? [])
        if (opAt >= 0)
          add(splice(formula, opAt, opAt + n.op.length, op), `${n.op} written as ${op}`);
    } else if (n.type === "string") {
      // The wrong criteria: another value from the same column of the sheet.
      const column = s.rows.findIndex((r) => r.some((v) => v === n.value));
      if (column >= 0) {
        const col = (s.rows[column] ?? []).indexOf(n.value);
        const other = s.rows
          .map((r) => r[col])
          .find((v) => typeof v === "string" && v !== n.value && v !== s.rows[0]?.[col]);
        if (typeof other === "string")
          add(
            splice(formula, n.start, n.end, `"${other.replaceAll('"', '""')}"`),
            `criteria "${n.value}" swapped for "${other}"`,
          );
      }
      const m = /^(>=|<=|<>|>|<|=)/u.exec(n.value);
      for (const op of m ? (SWAP_OP[m[1] as string] ?? []) : [])
        add(
          splice(
            formula,
            n.start,
            n.end,
            `"${op}${n.value.slice((m?.[1] ?? "").length).replaceAll('"', '""')}"`,
          ),
          `criteria "${n.value}" written with ${op}`,
        );
    } else if (n.type === "number" && Number.isInteger(n.value)) {
      add(
        splice(formula, n.start, n.end, String(n.value + 1)),
        `${n.value} written as ${n.value + 1}`,
      );
      if (n.value > 0)
        add(
          splice(formula, n.start, n.end, String(n.value - 1)),
          `${n.value} written as ${n.value - 1}`,
        );
    } else if (n.type === "bool") {
      add(
        splice(formula, n.start, n.end, n.value ? "FALSE" : "TRUE"),
        `${text} written as ${n.value ? "FALSE" : "TRUE"}`,
      );
    } else if (n.type === "call") {
      for (const to of SWAP_FN[n.name] ?? [])
        add(splice(formula, n.nameStart, n.nameEnd, to), `${to} instead of ${n.name}`);
      const first = n.args[0];
      if (UNWRAP.has(n.name) && first && first.type !== "empty")
        add(
          splice(formula, n.start, n.end, formula.slice(first.start, first.end)),
          `without ${n.name}`,
        );
      // A criteria function missing its last pair, or a lookup without its exact-match argument.
      if ((n.name === "SUMIFS" || n.name === "AVERAGEIFS") && n.args.length >= 5) {
        const cut = n.args[n.args.length - 3];
        if (cut)
          add(splice(formula, cut.end, n.end - 1, ""), `${n.name} without its last condition`);
      }
      if (n.name === "COUNTIFS" && n.args.length >= 4) {
        const cut = n.args[n.args.length - 3];
        if (cut)
          add(splice(formula, cut.end, n.end - 1, ""), "COUNTIFS without its last condition");
      }
      if (n.name === "VLOOKUP" && n.args.length === 4) {
        const third = n.args[2];
        if (third) add(splice(formula, third.end, n.end - 1, ""), "VLOOKUP without FALSE");
      }
    } else if (
      n.type === "unary" &&
      n.op === "-" &&
      n.operand.type === "unary" &&
      n.operand.op === "-"
    ) {
      add(
        splice(
          formula,
          n.start,
          n.end,
          formula.slice(n.operand.operand.start, n.operand.operand.end),
        ),
        "without the -- conversion",
      );
    }
  }
  // The result typed in, or a pointer at a cell that happens to hold it.
  if (!Array.isArray(s.expected)) {
    const e = s.expected;
    add(
      typeof e === "string"
        ? `="${e.replaceAll('"', '""')}"`
        : `=${typeof e === "boolean" ? String(e).toUpperCase() : e}`,
      "result typed in",
    );
    s.rows.forEach((row, r) => {
      row.forEach((v, c) => {
        if (v !== null && v === e)
          add(
            `=${letters(c + 1)}${r + 1}`,
            `points at ${letters(c + 1)}${r + 1}, which holds the result`,
          );
      });
    });
  }
  return out;
}

// Criteria text such as ">=100" or "North" as a comparison over a range.
function criteriaTest(range: string, crit: Node, formula: string): string | null {
  const text = formula.slice(crit.start, crit.end);
  if (crit.type === "ref") return `(${range}=${text})`;
  if (crit.type === "number") return `(${range}=${text})`;
  if (crit.type !== "string") return null;
  if (/[*?~]/u.test(crit.value)) return null;
  const m = /^(>=|<=|<>|>|<|=)?(.*)$/u.exec(crit.value);
  const op = m?.[1] ?? "=";
  const rest = m?.[2] ?? "";
  const num = rest !== "" && !Number.isNaN(Number(rest)) ? rest : `"${rest.replaceAll('"', '""')}"`;
  return `(${range}${op}${num})`;
}

const argText = (f: string, n: Node | undefined) => (n ? f.slice(n.start, n.end) : "");

/** The reference answer rewritten into other function families. Excel keeps only the ones that work. */
export function rewrites(formula: string): Candidate[] {
  const p = parse(formula);
  if (!p.ok) return [];
  const out: Candidate[] = [];
  const add = (start: number, end: number, text: string, note: string) =>
    out.push({ formula: splice(formula, start, end, text), source: "rewrite", note });
  walkAst(p.ast, (n) => {
    if (n.type !== "call") return;
    const a = n.args;
    const t = (i: number) => argText(formula, a[i]);
    const pairs = (from: number) => {
      const tests: string[] = [];
      for (let i = from; i + 1 < a.length; i += 2) {
        const r = t(i);
        const c = a[i + 1];
        const test = c ? criteriaTest(r, c, formula) : null;
        if (!test) return null;
        tests.push(test);
      }
      return tests;
    };
    if (n.name === "SUMIF" && a.length >= 2) {
      const sum = a.length === 3 ? t(2) : t(0);
      add(n.start, n.end, `SUMIFS(${sum},${t(0)},${t(1)})`, "SUMIF as SUMIFS");
      const test = a[1] ? criteriaTest(t(0), a[1], formula) : null;
      if (test) {
        add(n.start, n.end, `SUMPRODUCT(${test}*${sum})`, "SUMIF as SUMPRODUCT");
        add(n.start, n.end, `SUM(FILTER(${sum},${test},0))`, "SUMIF as SUM of FILTER");
      }
    }
    if (n.name === "SUMIFS" && a.length >= 3) {
      const tests = pairs(1);
      if (tests) {
        add(n.start, n.end, `SUMPRODUCT(${tests.join("*")}*${t(0)})`, "SUMIFS as SUMPRODUCT");
        add(n.start, n.end, `SUM(FILTER(${t(0)},${tests.join("*")},0))`, "SUMIFS as SUM of FILTER");
      }
      if (a.length === 3) add(n.start, n.end, `SUMIF(${t(1)},${t(2)},${t(0)})`, "SUMIFS as SUMIF");
    }
    if (n.name === "COUNTIF" && a.length === 2) {
      add(n.start, n.end, `COUNTIFS(${t(0)},${t(1)})`, "COUNTIF as COUNTIFS");
      const test = a[1] ? criteriaTest(t(0), a[1], formula) : null;
      if (test) add(n.start, n.end, `SUMPRODUCT(--${test})`, "COUNTIF as SUMPRODUCT");
    }
    if (n.name === "COUNTIFS" && a.length >= 2) {
      const tests = pairs(0);
      if (tests)
        add(
          n.start,
          n.end,
          tests.length > 1 ? `SUMPRODUCT(${tests.join("*")})` : `SUMPRODUCT(--${tests[0]})`,
          "COUNTIFS as SUMPRODUCT",
        );
      if (a.length === 2) add(n.start, n.end, `COUNTIF(${t(0)},${t(1)})`, "COUNTIFS as COUNTIF");
    }
    if (n.name === "AVERAGEIF" && a.length >= 2) {
      const avg = a.length === 3 ? t(2) : t(0);
      add(n.start, n.end, `AVERAGEIFS(${avg},${t(0)},${t(1)})`, "AVERAGEIF as AVERAGEIFS");
      const test = a[1] ? criteriaTest(t(0), a[1], formula) : null;
      if (test)
        add(n.start, n.end, `AVERAGE(FILTER(${avg},${test}))`, "AVERAGEIF as AVERAGE of FILTER");
    }
    if (n.name === "AVERAGEIFS" && a.length >= 3) {
      const tests = pairs(1);
      if (tests)
        add(
          n.start,
          n.end,
          `AVERAGE(FILTER(${t(0)},${tests.join("*")}))`,
          "AVERAGEIFS as AVERAGE of FILTER",
        );
    }
    if (
      n.name === "VLOOKUP" &&
      a.length >= 3 &&
      a[1]?.type === "range" &&
      a[2]?.type === "number"
    ) {
      const exact = a.length === 4 && /^(FALSE|0)$/iu.test(t(3));
      const [first, last] = t(1).split(":");
      const m1 = first ? COL.exec(first) : null;
      const m2 = last ? COL.exec(last) : null;
      if (m1 && m2) {
        const c0 = colNum(m1[2] as string);
        const k = a[2].value;
        const keyCol = `${m1[1]}${m1[2]}${m1[3]}${m1[4]}:${m1[1]}${m1[2]}${m2[3]}${m2[4]}`;
        const ret = `${m1[1]}${letters(c0 + k - 1)}${m1[3]}${m1[4]}:${m2[1]}${letters(c0 + k - 1)}${m2[3]}${m2[4]}`;
        if (exact) {
          add(n.start, n.end, `XLOOKUP(${t(0)},${keyCol},${ret})`, "VLOOKUP as XLOOKUP");
          add(
            n.start,
            n.end,
            `INDEX(${ret},MATCH(${t(0)},${keyCol},0))`,
            "VLOOKUP as INDEX and MATCH",
          );
        } else {
          add(
            n.start,
            n.end,
            `XLOOKUP(${t(0)},${keyCol},${ret},,-1)`,
            "approximate VLOOKUP as XLOOKUP",
          );
          add(
            n.start,
            n.end,
            `INDEX(${ret},MATCH(${t(0)},${keyCol},1))`,
            "approximate VLOOKUP as INDEX and MATCH",
          );
        }
      }
    }
    if (n.name === "INDEX" && a.length === 2 && a[1]?.type === "call" && a[1].name === "MATCH") {
      const m = a[1].args;
      const type = argText(formula, m[2]);
      if (m.length === 3 && type === "0")
        add(
          n.start,
          n.end,
          `XLOOKUP(${argText(formula, m[0])},${argText(formula, m[1])},${t(0)})`,
          "INDEX and MATCH as XLOOKUP",
        );
    }
    if (n.name === "XLOOKUP" && (a.length === 3 || a.length === 4)) {
      const base = `INDEX(${t(2)},MATCH(${t(0)},${t(1)},0))`;
      add(
        n.start,
        n.end,
        a.length === 4 ? `IFERROR(${base},${t(3)})` : base,
        "XLOOKUP as INDEX and MATCH",
      );
      if (a[1]?.type === "range" && a[2]?.type === "range") {
        const [k1] = t(1).split(":");
        const [r1, r2] = t(2).split(":");
        const mk = k1 ? COL.exec(k1) : null;
        const ma = r1 ? COL.exec(r1) : null;
        const mb = r2 ? COL.exec(r2) : null;
        if (
          mk &&
          ma &&
          mb &&
          colNum(ma[2] as string) > colNum(mk[2] as string) &&
          ma[2] === mb[2]
        ) {
          const idx = colNum(ma[2] as string) - colNum(mk[2] as string) + 1;
          const table = `${t(1).split(":")[0]}:${r2}`;
          const v = `VLOOKUP(${t(0)},${table},${idx},FALSE)`;
          add(n.start, n.end, a.length === 4 ? `IFERROR(${v},${t(3)})` : v, "XLOOKUP as VLOOKUP");
        }
      }
    }
    if (
      n.name === "IFERROR" &&
      a.length === 2 &&
      a[0]?.type === "call" &&
      ["VLOOKUP", "MATCH", "XLOOKUP"].includes(a[0].name)
    )
      add(n.start, n.end, `IFNA(${t(0)},${t(1)})`, "IFERROR as IFNA");
    if (n.name === "SUM" && a.length === 1 && a[0]?.type === "range")
      add(n.start, n.end, `SUMPRODUCT(${t(0)})`, "SUM as SUMPRODUCT");
    if (n.name === "IF" && a.length === 3)
      add(n.start, n.end, `IFS(${t(0)},${t(1)},TRUE,${t(2)})`, "IF as IFS");
  });
  // The whole formula wrapped in LET, naming the first range it reads.
  const range = nodesOf(formula).find((n) => n.type === "range");
  if (range) {
    const text = formula.slice(range.start, range.end);
    out.push({
      formula: `=LET(data,${text},${formula.slice(1).replaceAll(text, "data")})`,
      source: "rewrite",
      note: "LET naming the first range",
    });
  }
  return out;
}

// ---------------------------------------------------------------- audit fixtures

export interface AuditScreen {
  correct?: string[];
  wrong?: { formula: string; rule: string; why?: string }[];
  /** Mutants that Excel and the grader both accept, reviewed as equivalent here. */
  equivalent?: { formula: string; why: string }[];
}

export function loadAuditFixture(t: TaskScreen, root = "."): AuditScreen {
  const path = `${root}/tools/audit/formulas/${t.kind}/${t.id}.yaml`;
  if (!existsSync(path)) return {};
  const data = parseYaml(readFileSync(path, "utf8")) as { screens?: AuditScreen[] };
  return data.screens?.[t.index] ?? {};
}

export function candidatesOf(t: TaskScreen, fixture: AuditScreen = {}): Candidate[] {
  const s = t.screen;
  const all: Candidate[] = [
    { formula: s.answer, source: "reference", note: "" },
    ...s.accept.map((formula) => ({ formula, source: "accept" as const, note: "" })),
    ...s.reject.map((r) => ({ formula: r.formula, source: "reject" as const, note: r.rule })),
    ...(fixture.correct ?? []).map((formula) => ({
      formula,
      source: "audit-correct" as const,
      note: "",
    })),
    ...(fixture.wrong ?? []).map((w) => ({
      formula: w.formula,
      source: "audit-wrong" as const,
      note: w.rule,
    })),
    ...restyles(s.answer),
    ...rewrites(s.answer),
    ...mutants(s.answer, s),
  ];
  const seen = new Set<string>();
  return all.filter((c) => !seen.has(c.formula) && seen.add(c.formula));
}

// ---------------------------------------------------------------- judging

const near = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

function sameCell(got: ExcelScalar | undefined, want: CellInput): boolean {
  const g = got === null || got === undefined ? 0 : got;
  const w = want === null ? 0 : want;
  if (typeof g === "number" && typeof w === "number") return near(g, w);
  return g === w;
}

/** Whether Excel's result is the expected one, judged as the grader judges (case-sensitive text). */
export function excelMatches(r: ExcelResult, expected: Expected): boolean {
  if (r.invalid) return false;
  const v = r.value;
  if (Array.isArray(expected)) {
    const block = Array.isArray(v) ? v : [[v as ExcelScalar]];
    return (
      block.length === expected.length &&
      block.every(
        (row, i) =>
          row.length === expected[i]?.length &&
          row.every((c, j) => sameCell(c, expected[i]?.[j] ?? null)),
      )
    );
  }
  if (Array.isArray(v)) return false;
  // An empty single cell is not a match for anything but an empty-looking expected.
  if (v === null) return expected === 0;
  return sameCell(v, expected as CellInput);
}

export type Outcome =
  | "ok" // grader and Excel agree
  | "wrong-passes" // Excel finds it wrong, the grader accepts it
  | "correct-fails" // Excel finds it right, the grader rejects it on value or fragile
  | "policy" // Excel finds it right, the grader rejects it for a function the prompt never names
  | "survivor" // a mutant Excel and the grader both accept: data may not separate it
  | "excel-refuses" // Excel will not take the formula; the grader should say syntax
  | "locale"; // Excel disagrees, but this Excel reads separators by the en_CZ region: needs an en-US check

export interface Judged {
  candidate: Candidate;
  excelRight: boolean;
  excelRefused: boolean;
  /** For each sheet, Excel's value. */
  excel: ExcelResult[];
  verdict: Verdict;
  outcome: Outcome;
}

/**
 * True when Excel's answer here depends on the region's separators: text such
 * as "1,050" or "12.5" that a formula turns into a number, or a TEXT format.
 * This Excel runs in en_CZ, so such screens need an en-US check.
 */
export function localeSensitive(t: TaskScreen, formula: string): boolean {
  const textNumber = /^\s*-?(?:\d{1,3}(?:,\d{3})+|\d*\.\d+|\d+,\d+)\s*%?\s*$/u;
  const cells = sheetsOf(t.screen).flatMap((sh) => sh.rows.flat());
  return (
    cells.some((v) => typeof v === "string" && textNumber.test(v)) ||
    /\bTEXT\(/iu.test(formula) ||
    // A criteria string with a decimal point, such as "<0.3", is text to a decimal-comma Excel.
    /"[<>=]*-?\d*\.\d+"/u.test(formula)
  );
}

export function judgeCandidate(t: TaskScreen, c: Candidate, excel: ExcelResult[]): Judged {
  const sheets = sheetsOf(t.screen);
  const excelRefused = excel.some(
    (r) =>
      r.invalid !== undefined &&
      !r.invalid.startsWith("runner") &&
      r.invalid !== "skipped" &&
      r.invalid !== "not cached",
  );
  const excelRight =
    !excelRefused && sheets.every((sh, i) => excelMatches(excel[i] as ExcelResult, sh.expected));
  const verdict = grade(c.formula, specOf(t.screen));
  // A formula that reads no cells is a typed result: rejecting it is the point,
  // whichever rule speaks first.
  const readsNothing = verdict.reads.length === 0;
  // The prompt or the title names every function the screen requires or forbids, so that
  // rule is stated (the same test as unstatedRequirements in validate-content.ts).
  const named = [...t.screen.requiredFunctions, ...t.screen.forbiddenFunctions].every((f) =>
    new RegExp(`\\b${f}\\b`, "iu").test(`${t.screen.prompt} ${t.title ?? ""}`),
  );
  let outcome: Outcome = "ok";
  if (excelRefused) outcome = verdict.rule === "syntax" ? "ok" : "excel-refuses";
  else if (excelRight && !verdict.correct) {
    if (readsNothing && verdict.rule !== "value" && verdict.rule !== "fragile") outcome = "ok";
    // Excel quietly adds a missing ")" where the grader asks for it: both are fair.
    else if (verdict.rule === "syntax" && /\(|"/u.test(c.formula) && c.note === "syntax")
      outcome = "ok";
    else if (verdict.rule === "required-function" || verdict.rule === "forbidden-function")
      outcome = named ? "ok" : "policy";
    else outcome = localeSensitive(t, c.formula) ? "locale" : "correct-fails";
  } else if (!excelRight && verdict.correct)
    outcome = localeSensitive(t, c.formula) ? "locale" : "wrong-passes";
  else if (excelRight && verdict.correct && c.source === "mutant") outcome = "survivor";
  return { candidate: c, excelRight, excelRefused, excel, verdict, outcome };
}

/** Numbers quoted in feedback text that appear nowhere in the screen's data or results. */
export function strayNumbers(text: string, t: TaskScreen): string[] {
  const s = t.screen;
  const known = new Set<number>();
  const addAll = (v: unknown): void => {
    if (typeof v === "number") known.add(Math.round(v * 1e6) / 1e6);
    if (typeof v === "string" && /^-?[\d,]*\.?\d+$/u.test(v))
      known.add(Number(v.replaceAll(",", "")));
    if (Array.isArray(v)) v.forEach(addAll);
  };
  addAll(s.rows);
  addAll(s.expected);
  // Thresholds and constants the brief or the formulas state, such as "at least 60".
  for (const t of [s.prompt, s.answer, ...s.accept])
    for (const m of t.matchAll(/-?\d[\d,]*(?:\.\d+)?/gu)) addAll(m[0]);
  for (const v of s.variants ?? []) {
    addAll(Object.values(v.set));
    addAll(v.expected);
  }
  const stray: string[] = [];
  // Skip cell addresses (B6), ordinals and small counts, which feedback uses freely.
  for (const m of text
    .replace(/`[^`]*`/gu, " ")
    .matchAll(/(?<![A-Za-z$\d.])-?\d[\d,]*(?:\.\d+)?(?![\d%A-Za-z])/gu)) {
    const n = Number(m[0].replaceAll(",", ""));
    if (Number.isInteger(n) && Math.abs(n) <= 12) continue;
    if (!known.has(Math.round(n * 1e6) / 1e6)) stray.push(m[0]);
  }
  return stray;
}
