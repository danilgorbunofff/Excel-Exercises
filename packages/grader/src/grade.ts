// Why this exists: checks a learner's formula against an exercise and says
// precisely what is wrong. Rules run in a fixed order: syntax, required
// function, forbidden function, references, value. The first failure is the
// verdict. A formula that passes is then run on each variant of the data,
// so a result typed in or tied to these numbers fails as "fragile".
// Everything the interface draws (what the formula read) comes from
// the parse tree, never from the message text.
import { type Address, formatAddress, parseAddress } from "./address.ts";
import { type ErrorCode, errorValue, isError } from "./errors.ts";
import { evaluate } from "./evaluate.ts";
import { isExcelFunction } from "./functions/excel-names.ts";
import { FUNCTIONS } from "./functions/index.ts";
import { isKnownFunction } from "./functions/registry.ts";
import { type CellInput, createGrid, type Grid } from "./grid.ts";
import { type Node, parse } from "./parse.ts";
import { type Box, rangeBox } from "./range.ts";
import { formatNumber, isRange, rowsOf, type Scalar, toScalar, type Value } from "./values.ts";
import { walkAst } from "./walk.ts";

export const RULES = [
  "syntax",
  "required-function",
  "forbidden-function",
  "reference",
  "value",
  "fragile",
] as const;
export type Rule = (typeof RULES)[number];

/** One value, or for a formula that spills, the block it fills from the answer cell. */
export type Expected = number | string | boolean | readonly (readonly CellInput[])[];

/** The same sheet with some cells changed, and the result the formula must give then. */
export interface Variant {
  set: Readonly<Record<string, CellInput>>;
  expected: Expected;
}

export interface GradeSpec {
  rows: readonly (readonly CellInput[])[];
  answerCell: string;
  expected: Expected;
  requiredFunctions: readonly string[];
  forbiddenFunctions: readonly string[];
  requireReference: boolean;
  variants?: readonly Variant[];
}

/** A cell or range the formula reads, with where it is written in the formula. */
export interface Read {
  text: string;
  start: number;
  end: number;
  box: Box;
  cells: number;
  /** How many of the cells hold numbers, and their total. */
  numbers: number;
  sum: number;
  includesAnswerCell: boolean;
}

export interface Verdict {
  correct: boolean;
  rule: Rule | null;
  /** One or two short sentences. Code is wrapped in backticks. */
  message: string;
  /** The part of the formula the message is about, if any. */
  start?: number;
  end?: number;
  /** The computed value and how the cell would show it, once the formula was evaluated. */
  value?: Scalar;
  display?: string;
  /** Every cell of a result that spills, top-left first, when the formula returns more than one. */
  spill?: Scalar[][];
  reads: Read[];
}

/** Arguments that set how a function works. Typed numbers there are not data. */
const SETTING_ARGS: Record<string, number[]> = {
  VLOOKUP: [2, 3],
  HLOOKUP: [2, 3],
  // Fallbacks (if_empty, value_if_error, if_not_found) are the task's choice, not data.
  FILTER: [2],
  IFERROR: [1],
  IFNA: [1],
  XLOOKUP: [3, 4, 5],
  MATCH: [2],
  INDEX: [1, 2],
  ROUND: [1],
  ROUNDUP: [1],
  ROUNDDOWN: [1],
  LEFT: [1],
  RIGHT: [1],
  MID: [1, 2],
  MOD: [1],
  DATE: [0, 1, 2],
  WEEKDAY: [1],
  EOMONTH: [1],
  SUBSTITUTE: [3],
  FIND: [2],
  SEARCH: [2],
  TEXTJOIN: [1],
  LARGE: [1],
  SMALL: [1],
  RANK: [2],
  MROUND: [1],
  FLOOR: [1],
  CEILING: [1],
  SUBTOTAL: [0],
  AGGREGATE: [0, 1, 3],
  TEXTBEFORE: [2, 3, 4],
  TEXTAFTER: [2, 3, 4],
  REPLACE: [1, 2],
  EDATE: [1],
  UNIQUE: [1, 2],
  SORT: [1, 2, 3],
  SORTBY: [2, 4, 6, 8],
  SEQUENCE: [0, 1, 2, 3],
  TAKE: [1, 2],
  CHOOSECOLS: [1, 2, 3, 4, 5, 6, 7, 8],
};

const COMPARISONS = new Set(["=", "<>", "<", ">", "<=", ">="]);

/** True when the node reads a cell or a range somewhere inside it, or a LET name, which stands for them. */
function readsCells(node: Node): boolean {
  let found = false;
  walkAst(node, (n) => {
    if (n.type === "ref" || n.type === "range" || n.type === "name") found = true;
  });
  return found;
}

const ERROR_EXPLANATIONS: Record<ErrorCode, string> = {
  "#CALC!": "the calculation gave an empty result, such as a FILTER that matched nothing",
  "#SPILL!": "the result needs more cells, and some of them already hold data",
  "#DIV/0!": "the formula divides by zero or by an empty cell",
  "#N/A": "a lookup did not find a match",
  "#VALUE!": "a value has the wrong type, such as text where a number belongs",
  "#REF!": "a reference points outside its range",
  "#NUM!": "a number is out of range for the calculation",
  "#NAME?": "Excel does not recognise a name in the formula",
  "#NULL!": "two ranges do not overlap",
};

export function formatValue(v: Scalar): string {
  if (v === null) return "";
  if (isError(v)) return v.code;
  if (typeof v === "number") return formatNumber(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return v;
}

function readsOf(ast: Node, grid: Grid, answer: Address): Read[] {
  const reads: Read[] = [];
  walkAst(ast, (n) => {
    if (n.type !== "ref" && n.type !== "range") return;
    const box =
      n.type === "ref"
        ? { top: n.address.row, bottom: n.address.row, left: n.address.col, right: n.address.col }
        : rangeBox(n.first, n.last, grid.size);
    let numbers = 0;
    let sum = 0;
    for (let row = box.top; row <= box.bottom; row++) {
      for (let col = box.left; col <= box.right; col++) {
        const v = row === answer.row && col === answer.col ? null : grid.get({ col, row });
        if (typeof v === "number") {
          numbers++;
          sum += v;
        }
      }
    }
    reads.push({
      text: n.text,
      start: n.start,
      end: n.end,
      box,
      cells: (box.bottom - box.top + 1) * (box.right - box.left + 1),
      numbers,
      sum,
      includesAnswerCell:
        answer.row >= box.top &&
        answer.row <= box.bottom &&
        answer.col >= box.left &&
        answer.col <= box.right,
    });
  });
  return reads;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Problems Excel would report before calculating: unknown names and argument counts. */
function checkNames(ast: Node): Omit<Verdict, "reads" | "correct" | "rule"> | null {
  let problem: Omit<Verdict, "reads" | "correct" | "rule"> | null = null;
  // Names a LET binds are not unknown names.
  const bound = new Set<string>();
  walkAst(ast, (n) => {
    if (problem || n.type !== "call" || n.name !== "LET") return;
    const here = new Set<string>();
    for (let i = 0; i + 1 < n.args.length; i += 2) {
      const a = n.args[i];
      const name = a?.type === "name" ? a.name : a?.type === "ref" ? a.text : null;
      if (!a || name === null) continue;
      // Excel refuses a LET name with a full stop in it.
      if (name.includes(".")) {
        problem = {
          message: `Use only letters, digits and _ in a LET name such as ${name.replaceAll(".", "_")}.`,
          start: a.start,
          end: a.end,
        };
        return;
      }
      // Excel refuses a LET that names the same step twice.
      if (here.has(name.toUpperCase())) {
        problem = {
          message: `LET uses the name ${name} twice. Give each step its own name.`,
          start: a.start,
          end: a.end,
        };
        return;
      }
      here.add(name.toUpperCase());
      bound.add(name.toUpperCase());
    }
  });
  walkAst(ast, (n) => {
    if (problem) return;
    if (n.type === "name" && !bound.has(n.name.toUpperCase())) {
      // B2xB3 starts like a cell address: the learner meant cells, not text.
      const joined = /^\$?[A-Z]{1,3}\$?[0-9]+[^0-9]/iu.test(n.name);
      const fnName = n.name.toUpperCase();
      problem = {
        message: isKnownFunction(fnName)
          ? `${fnName} needs brackets, such as ${fnName}(B2:B5).`
          : joined
            ? `Excel reads ${n.name} as one name. To join two cells, put an operator such as \`*\` between them.`
            : `Excel reads ${n.name} as a name. If you mean text, put it in quotes: \`"${n.name}"\`.`,
        start: n.start,
        end: n.end,
      };
    }
    if (n.type === "call") {
      const spec = FUNCTIONS[n.name];
      const span = { start: n.nameStart, end: n.nameEnd };
      if (!spec) {
        // A real Excel function the practice sheet cannot run is the grader's gap, not the learner's slip.
        problem = {
          message: isExcelFunction(n.name)
            ? `This practice sheet cannot run ${n.name} yet, so it cannot check this formula. Try another way to get the same result.`
            : `Excel has no function called ${n.name}.`,
          ...span,
        };
        return;
      }
      const count = n.args.length;
      if (count < spec.min || count > spec.max) {
        const message =
          spec.min === spec.max
            ? `${n.name} ${spec.min === 0 ? "takes no arguments" : count < spec.min ? `needs ${plural(spec.min, "argument")}` : `takes ${plural(spec.max, "argument")}`}.`
            : count < spec.min
              ? `${n.name} needs at least ${plural(spec.min, "argument")}.`
              : `${n.name} takes at most ${plural(spec.max, "argument")}.`;
        problem = { message, ...span };
      }
    }
  });
  return problem;
}

/**
 * The first number typed into the formula that is also a value in the data.
 * When the value is in several cells, a cell the formula does not already
 * read is named, such as a lookup's input cell rather than a key in its table.
 */
function typedDataNumber(
  ast: Node,
  grid: Grid,
  answer: Address,
  reads: readonly Read[],
): { node: Node; value: number; at: Address } | null {
  const isRead = (col: number, row: number) =>
    reads.some(
      ({ box }) => row >= box.top && row <= box.bottom && col >= box.left && col <= box.right,
    );
  const where = new Map<number, Address>();
  const fallback = new Map<number, Address>();
  for (let row = grid.size.rows; row >= 1; row--) {
    for (let col = grid.size.cols; col >= 1; col--) {
      const v = grid.get({ col, row });
      if (typeof v !== "number" || (row === answer.row && col === answer.col)) continue;
      (isRead(col, row) ? fallback : where).set(v, { col, row });
    }
  }
  for (const [v, at] of fallback) if (!where.has(v)) where.set(v, at);
  let found: { node: Node; value: number; at: Address } | null = null;
  const settings = new Set<Node>();
  walkAst(ast, (n, parent) => {
    if (n.type === "call") {
      for (const i of SETTING_ARGS[n.name] ?? []) {
        const a = n.args[i];
        if (a) walkAst(a, (x) => settings.add(x));
      }
      // SWITCH's case values sit at 1, 3, 5 and so on; a last odd one is the default.
      if (n.name === "SWITCH") {
        for (let i = 1; i + 1 < n.args.length; i += 2) {
          const a = n.args[i];
          if (a) walkAst(a, (x) => settings.add(x));
        }
      }
    }
    // A number compared with something that reads cells is a threshold from
    // the task, as in B2>=70 or COUNTIF(...)=0, not a value copied from the data.
    if (n.type === "binary" && COMPARISONS.has(n.op)) {
      if (readsCells(n.left)) walkAst(n.right, (x) => x.type === "number" && settings.add(x));
      if (readsCells(n.right)) walkAst(n.left, (x) => x.type === "number" && settings.add(x));
    }
    if (found || n.type !== "number" || settings.has(n)) return;
    // A typed -2 is reported as -2 when the data holds -2, with the sign in its span.
    const negative =
      parent?.type === "unary" && parent.op === "-" ? where.get(-n.value) : undefined;
    if (negative && parent) found = { node: parent, value: -n.value, at: negative };
    else {
      const at = where.get(n.value);
      if (at) found = { node: n, value: n.value, at };
    }
  });
  return found;
}

function sameValue(actual: Scalar, expected: CellInput): boolean {
  if (typeof expected === "number" && typeof actual === "number") {
    return Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(actual), Math.abs(expected));
  }
  return actual === expected;
}

export function grade(formula: string, spec: GradeSpec): Verdict {
  const answer = parseAddress(spec.answerCell);
  if (!answer) throw new Error(`Invalid answer cell: ${spec.answerCell}`);
  const cellName = formatAddress(answer);
  const parsed = parse(formula.trim());
  if (!parsed.ok) {
    return {
      correct: false,
      rule: "syntax",
      message: parsed.error.message,
      start: parsed.error.start,
      end: parsed.error.end,
      reads: [],
    };
  }
  const ast = parsed.ast;
  const grid = createGrid(spec.rows);
  const reads = readsOf(ast, grid, answer);
  const miss = (
    rule: Rule,
    message: string,
    span: { start?: number; end?: number } = {},
  ): Verdict => ({
    correct: false,
    rule,
    message,
    ...span,
    reads,
  });

  const names = checkNames(ast);
  if (names) return { correct: false, rule: "syntax", reads, ...names };

  const calls: { name: string; start: number; end: number }[] = [];
  walkAst(ast, (n) => {
    if (n.type === "call") calls.push({ name: n.name, start: n.nameStart, end: n.nameEnd });
  });
  for (const required of spec.requiredFunctions) {
    if (!calls.some((c) => c.name === required.toUpperCase())) {
      return miss(
        "required-function",
        `This exercise asks for ${required.toUpperCase()}, and the formula does not use it.`,
      );
    }
  }
  for (const forbidden of spec.forbiddenFunctions) {
    const call = calls.find((c) => c.name === forbidden.toUpperCase());
    if (call)
      return miss(
        "forbidden-function",
        `This exercise asks you to solve it without ${call.name}.`,
        call,
      );
  }

  const circular = reads.find((r) => r.includesAnswerCell);
  if (circular) {
    return miss(
      "reference",
      `The formula reads ${cellName}, the cell it is in. Excel calls this a circular reference.`,
      circular,
    );
  }
  if (spec.requireReference) {
    // A typed data value is named first: it tells the learner which cell to use.
    const typed = typedDataNumber(ast, grid, answer, reads);
    if (typed) {
      const at = formatAddress(typed.at);
      return miss(
        "reference",
        `You typed ${formatNumber(typed.value)}, the value in ${at}. Point at ${at} instead, so the result updates when the data changes.`,
        typed.node,
      );
    }
    if (reads.length === 0) {
      return miss(
        "reference",
        "The formula uses no cells. Point at the data, so the result updates when it changes.",
      );
    }
  }

  const main = judge(evaluate(ast, grid, { cell: answer }), spec.expected, grid, answer);
  const verdict = (rule: Rule | null, message = main.message): Verdict => ({
    correct: rule === null,
    rule,
    message,
    ...(main.value !== undefined ? { value: main.value, display: main.display } : {}),
    ...(main.spill ? { spill: main.spill } : {}),
    reads,
  });
  if (!main.ok) return verdict("value");
  for (const variant of spec.variants ?? []) {
    const changed = createGrid(patch(spec.rows, variant.set));
    const run = judge(evaluate(ast, changed, { cell: answer }), variant.expected, changed, answer);
    if (run.ok) continue;
    // Errors in backticks, and an empty text as words, so the sentence reads.
    const spoken = (v: Scalar | undefined) =>
      v === undefined
        ? "something else"
        : isError(v)
          ? `\`${v.code}\``
          : v === "" || v === null
            ? "a blank"
            : formatValue(v);
    // Text that reads like the number, such as 19.99 joined with "", is named as text.
    const kind = (v: Scalar | undefined) =>
      typeof v === "string" ? "the text " : typeof v === "number" ? "the number " : "";
    const shown = [spoken(run.value), spoken(variant.expected as Scalar)];
    const [gotText, wantText] =
      shown[0] === shown[1]
        ? [`${kind(run.value)}${shown[0]}`, `${kind(variant.expected as Scalar)}${shown[1]}`]
        : shown;
    const instead = Array.isArray(variant.expected)
      ? ""
      : ` ${cellName} would show ${gotText} instead of ${wantText}.`;
    // When the only difference is rounding, say so: the data was not the problem.
    const want = variant.expected;
    const got = run.value;
    const places = typeof want === "number" ? (String(want).split(".")[1]?.length ?? 0) : -1;
    const unrounded =
      typeof want === "number" &&
      typeof got === "number" &&
      got !== want &&
      Math.abs(Math.round(got * 10 ** places) / 10 ** places - want) < 1e-9;
    return verdict(
      "fragile",
      unrounded
        ? `Right for this data, but not when the data changes.${instead} Round the result as the task asks.`
        : `Right for this data, but not when the data changes.${instead} Make the formula work from the cells, not from values you can see.`,
    );
  }
  return verdict(null);
}

/** The sheet with some cells changed. Cells past the edge grow the sheet. */
function patch(
  rows: readonly (readonly CellInput[])[],
  set: Readonly<Record<string, CellInput>>,
): CellInput[][] {
  const out = rows.map((r) => [...r]);
  for (const [address, value] of Object.entries(set)) {
    const at = parseAddress(address);
    if (!at) throw new Error(`Invalid variant cell: ${address}`);
    while (out.length < at.row) out.push([]);
    const row = out[at.row - 1] as CellInput[];
    while (row.length < at.col) row.push(null);
    row[at.col - 1] = value;
  }
  return out;
}

interface Outcome {
  ok: boolean;
  message: string;
  value?: Scalar;
  display?: string;
  spill?: Scalar[][];
}

const errorLine = (cell: string, v: Scalar) =>
  isError(v) ? `${cell} shows \`${v.code}\`: ${ERROR_EXPLANATIONS[v.code]}.` : null;

/** Whether a computed result is the expected one, and what to tell the learner if not. */
function judge(raw: Value, expected: Expected, grid: Grid, answer: Address): Outcome {
  const cellName = formatAddress(answer);
  if (Array.isArray(expected)) return judgeSpill(raw, expected, grid, answer);
  if (isRange(raw))
    return {
      ok: false,
      message: `The formula returns several cells, but ${cellName} holds one value.`,
    };
  const value = toScalar(raw);
  const display = formatValue(value);
  const out = (ok: boolean, message: string): Outcome => ({ ok, message, value, display });
  const want = expected as number | string | boolean;

  if (sameValue(value, want)) return out(true, `Correct. ${cellName} shows ${display}.`);
  const error = errorLine(cellName, value);
  if (error) return out(false, error);
  if (typeof want === "number" && typeof value === "string") {
    return out(
      false,
      `${cellName} shows the text \`"${value}"\`, but this exercise expects a number.`,
    );
  }
  if (
    typeof want === "string" &&
    typeof value === "string" &&
    value.toLowerCase() === want.toLowerCase()
  ) {
    return out(false, `${cellName} shows ${value}. Check upper and lower case.`);
  }
  return out(false, `${cellName} shows ${display}, which is not the result this exercise expects.`);
}

/** A result that fills a block from the answer cell, as FILTER or SORT does. Blanks show as 0, as in Excel. */
function judgeSpill(
  raw: Value,
  expected: readonly (readonly CellInput[])[],
  grid: Grid,
  answer: Address,
): Outcome {
  const cellName = formatAddress(answer);
  const rows = rowsOf(raw).map((r) => r.map((c) => (c === null ? 0 : c)));
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const top = rows[0]?.[0] ?? 0;
  const display = formatValue(top);
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      if ((i > 0 || j > 0) && grid.get({ col: answer.col + j, row: answer.row + i }) !== null) {
        return {
          ok: false,
          value: errorValue("#SPILL!"),
          display: "#SPILL!",
          message: `${cellName} shows \`#SPILL!\`: the result needs ${plural(h, "row")} and ${plural(w, "column")} from ${cellName}, and a cell in that area already holds data.`,
        };
      }
    }
  }
  const spill = h * w > 1 ? rows : undefined;
  const out = (ok: boolean, message: string): Outcome => ({
    ok,
    message,
    value: top,
    display,
    ...(spill ? { spill } : {}),
  });
  if (h * w === 1) {
    const error = errorLine(cellName, top);
    if (error) return out(false, error);
  }
  const eh = expected.length;
  const ew = expected[0]?.length ?? 0;
  if (h !== eh || w !== ew) {
    return out(
      false,
      `The result fills ${plural(h, "row")} and ${plural(w, "column")}, but this exercise expects ${plural(eh, "row")} and ${plural(ew, "column")}.`,
    );
  }
  for (let i = 0; i < h; i++) {
    for (let j = 0; j < w; j++) {
      const v = rows[i]?.[j] ?? 0;
      if (sameValue(v, expected[i]?.[j] ?? null)) continue;
      const at = formatAddress({ col: answer.col + j, row: answer.row + i });
      return out(
        false,
        errorLine(at, v) ??
          `${at} shows ${formatValue(v)}, which is not the result this exercise expects.`,
      );
    }
  }
  const end = formatAddress({ col: answer.col + w - 1, row: answer.row + h - 1 });
  return out(
    true,
    h * w === 1
      ? `Correct. ${cellName} shows ${display}.`
      : `Correct. The result fills ${cellName}:${end}.`,
  );
}
