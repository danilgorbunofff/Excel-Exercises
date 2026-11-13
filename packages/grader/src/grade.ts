// Why this exists: checks a learner's formula against an exercise and says
// precisely what is wrong. Rules run in a fixed order: syntax, required
// function, forbidden function, references, value. The first failure is the
// verdict. Everything the interface draws (what the formula read) comes from
// the parse tree, never from the message text.
import { type Address, formatAddress, parseAddress } from "./address.ts";
import { type ErrorCode, isError } from "./errors.ts";
import { evaluate } from "./evaluate.ts";
import { FUNCTIONS } from "./functions/index.ts";
import { type CellInput, createGrid, type Grid } from "./grid.ts";
import { type Node, parse } from "./parse.ts";
import { type Box, rangeBox } from "./range.ts";
import { formatNumber, isRange, type Scalar, toScalar } from "./values.ts";
import { walkAst } from "./walk.ts";

export const RULES = [
  "syntax",
  "required-function",
  "forbidden-function",
  "reference",
  "value",
] as const;
export type Rule = (typeof RULES)[number];

export interface GradeSpec {
  rows: readonly (readonly CellInput[])[];
  answerCell: string;
  expected: number | string | boolean;
  requiredFunctions: readonly string[];
  forbiddenFunctions: readonly string[];
  requireReference: boolean;
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
  reads: Read[];
}

/** Arguments that set how a function works. Typed numbers there are not data. */
const SETTING_ARGS: Record<string, number[]> = {
  VLOOKUP: [2, 3],
  HLOOKUP: [2, 3],
  XLOOKUP: [4, 5],
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
};

const COMPARISONS = new Set(["=", "<>", "<", ">", "<=", ">="]);

/** True when the node reads a cell or a range somewhere inside it. */
function readsCells(node: Node): boolean {
  let found = false;
  walkAst(node, (n) => {
    if (n.type === "ref" || n.type === "range") found = true;
  });
  return found;
}

const ERROR_EXPLANATIONS: Record<ErrorCode, string> = {
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
  walkAst(ast, (n) => {
    if (problem) return;
    if (n.type === "name") {
      // B2xB3 starts like a cell address: the learner meant cells, not text.
      const joined = /^\$?[A-Z]{1,3}\$?[0-9]+[^0-9]/iu.test(n.name);
      problem = {
        message: joined
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
        problem = { message: `Excel has no function called ${n.name}.`, ...span };
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

function sameValue(actual: Scalar, expected: GradeSpec["expected"]): boolean {
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

  const raw = evaluate(ast, grid, { cell: answer });
  if (isRange(raw))
    return miss("value", `The formula returns several cells, but ${cellName} holds one value.`);
  const value = toScalar(raw);
  const display = formatValue(value);
  const withValue = (rule: Rule | null, message: string): Verdict => ({
    correct: rule === null,
    rule,
    message,
    value,
    display,
    reads,
  });

  if (sameValue(value, spec.expected))
    return withValue(null, `Correct. ${cellName} shows ${display}.`);
  if (isError(value))
    return withValue(
      "value",
      `${cellName} shows \`${value.code}\`: ${ERROR_EXPLANATIONS[value.code]}.`,
    );
  if (typeof spec.expected === "number" && typeof value === "string") {
    return withValue(
      "value",
      `${cellName} shows the text \`"${value}"\`, but this exercise expects a number.`,
    );
  }
  if (
    typeof spec.expected === "string" &&
    typeof value === "string" &&
    value.toLowerCase() === spec.expected.toLowerCase()
  ) {
    return withValue("value", `${cellName} shows ${value}. Check upper and lower case.`);
  }
  return withValue(
    "value",
    `${cellName} shows ${display}, which is not the result this exercise expects.`,
  );
}
