// Why this exists: the formula explainer. It parses a formula with the grader,
// then evaluates every function call and operation inside it on its own, so
// each part can be shown with the value it works out to. Pure, so it is
// unit-tested and runs the same at build time and in the browser.
import {
  type CellInput,
  createGrid,
  criteriaMatcher,
  evaluate,
  formatValue,
  isError,
  type Node,
  parse,
  rangeBox,
  type Scalar,
  type Value,
} from "@practice/grader";

export interface Step {
  /** The part of the formula this step is about, as typed. */
  text: string;
  /** Where `text` sits in the formula, as [start, end) offsets that count the "=". */
  span: [number, number];
  /** What it works out to, as a cell would show it. */
  result: string;
  /** One line saying what this part does. Empty when the value says it all. */
  note: string;
  /** The argument this part fills, such as "sum range", from the function syntax. */
  arg?: string;
  /** For a range or a cell reference: its index in `refs`, which picks its colour. */
  ref?: number;
  /** Every reference read inside this part, as indexes into `refs`. */
  reads: number[];
  children: Step[];
}

/** A reference in the formula and the block of cells it reads, 1-based as in Excel. */
export interface Ref {
  text: string;
  box: { top: number; bottom: number; left: number; right: number };
}

/** A piece of the formula as typed. `ref` is set on references. */
export interface Segment {
  text: string;
  ref?: number;
}

export type Explained =
  /** `error`: the whole formula works out to an error value such as #N/A. */
  | {
      ok: true;
      result: string;
      steps: Step;
      error: boolean;
      /** Distinct references, in order of first appearance. */
      refs: Ref[];
      /** The formula split so each reference can be coloured. */
      formula: Segment[];
    }
  | { ok: false; message: string; at: number };

type Op = (a: string, b: string) => string;
const OPS: Record<string, [generic: string, Op]> = {
  "+": ["Adds the two sides.", (a, b) => `Adds ${a} and ${b}.`],
  "-": ["Subtracts the right side from the left.", (a, b) => `Subtracts ${b} from ${a}.`],
  "*": ["Multiplies the two sides.", (a, b) => `Multiplies ${a} by ${b}.`],
  "/": ["Divides the left side by the right.", (a, b) => `Divides ${a} by ${b}.`],
  "^": [
    "Raises the left side to the power of the right.",
    (a, b) => `Raises ${a} to the power of ${b}.`,
  ],
  "&": [
    "Joins the two sides into one piece of text.",
    (a, b) => `Joins ${a} and ${b} into one piece of text.`,
  ],
  "=": ["Tests whether the two sides are equal.", (a, b) => `Tests whether ${a} equals ${b}.`],
  "<>": ["Tests whether the two sides differ.", (a, b) => `Tests whether ${a} differs from ${b}.`],
  "<": [
    "Tests whether the left side is less than the right.",
    (a, b) => `Tests whether ${a} is less than ${b}.`,
  ],
  ">": [
    "Tests whether the left side is greater than the right.",
    (a, b) => `Tests whether ${a} is greater than ${b}.`,
  ],
  "<=": [
    "Tests whether the left side is less than or equal to the right.",
    (a, b) => `Tests whether ${a} is less than or equal to ${b}.`,
  ],
  ">=": [
    "Tests whether the left side is greater than or equal to the right.",
    (a, b) => `Tests whether ${a} is greater than or equal to ${b}.`,
  ],
};

/**
 * Conditional functions: where the range/criteria pairs start, and which
 * argument holds the values used for the matching cells (SUMIF falls back to its range).
 */
const CONDITIONAL: Record<string, { pairsFrom: number; target?: number; join?: string }> = {
  COUNTIF: { pairsFrom: 0 },
  COUNTIFS: { pairsFrom: 0 },
  SUMIF: { pairsFrom: 0, target: 2, join: " + " },
  SUMIFS: { pairsFrom: 1, target: 0, join: " + " },
  AVERAGEIF: { pairsFrom: 0, target: 2, join: ", " },
  AVERAGEIFS: { pairsFrom: 1, target: 0, join: ", " },
  MAXIFS: { pairsFrom: 1, target: 0, join: ", " },
  MINIFS: { pairsFrom: 1, target: 0, join: ", " },
};

const LITERALS = new Set(["number", "string", "bool", "array", "error"]);

/**
 * Argument labels for a call with `count` arguments, read from a syntax line such as
 * "=SUMIFS(sum_range, criteria_range1, criteria1, ...)". Arguments past the listed
 * names repeat the last numbered group: criteria_range2, criteria2, and so on.
 */
export function argLabels(syntax: string, count: number): (string | undefined)[] {
  const inside = syntax.slice(syntax.indexOf("(") + 1, syntax.lastIndexOf(")"));
  const names = inside
    .split(",")
    .map((s) => s.replace(/[[\]\s.]/g, ""))
    .filter(Boolean);
  const numbered = (name: string | undefined) => /\d+$/.exec(name ?? "");
  const last = numbered(names.at(-1));
  // shortcut: SWITCH and similar, with a fixed name after the repeat, get no labels past the list; upgrade if they get walkthroughs.
  const group =
    last && inside.includes("...")
      ? names.filter((n) => numbered(n)?.[0] === last[0]).map((n) => n.slice(0, -last[0].length))
      : [];
  const human = (n: string) => n.replaceAll("_", " ").replace(/(\D)(\d+)$/, "$1 $2");
  return Array.from({ length: count }, (_, i) => {
    if (i < names.length) return human(names[i] as string);
    if (!last || group.length === 0) return undefined;
    const past = i - names.length;
    const round = Number(last[0]) + 1 + Math.floor(past / group.length);
    return human(`${group[past % group.length]}${round}`);
  });
}

type RangeLike = { kind: "range"; rows: unknown[][] };
const isRangeValue = (v: Value): v is Value & RangeLike =>
  typeof v === "object" && v !== null && (v as { kind?: string }).kind === "range";

/** A value as a short label: a cell value, or the size of a range. */
export function describeValue(v: Value): string {
  if (isRangeValue(v)) {
    const rows = v.rows.length;
    const cols = v.rows[0]?.length ?? 0;
    if (rows * cols <= 6) {
      return `{${v.rows.map((r) => r.map((c) => formatValue(c as never) || '""').join(", ")).join("; ")}}`;
    }
    return `${rows} ${rows === 1 ? "row" : "rows"} x ${cols} ${cols === 1 ? "column" : "columns"}`;
  }
  const text = formatValue(v);
  return typeof v === "string" ? `"${text}"` : text === "" ? "(empty)" : text;
}

const cellCount = (v: Value) => (isRangeValue(v) ? v.rows.length * (v.rows[0]?.length ?? 0) : 1);

/**
 * Explains a formula against a sheet. `summaries` names what each function does;
 * `syntaxes` holds each function's syntax line, used to label its arguments.
 */
export function explain(
  formula: string,
  rows: readonly (readonly CellInput[])[],
  summaries: Readonly<Record<string, string>> = {},
  syntaxes: Readonly<Record<string, string>> = {},
): Explained {
  const source = formula.trim().startsWith("=") ? formula.trim() : `=${formula.trim()}`;
  const parsed = parse(source);
  if (!parsed.ok) {
    return { ok: false, message: parsed.error.message, at: parsed.error.start };
  }
  const grid = createGrid(rows);
  const value = (n: Node) => describeValue(evaluate(n, grid));
  const text = (n: Node) => source.slice(n.start, n.end);
  const base = (n: Node) => ({
    text: text(n),
    result: value(n),
    span: [n.start, n.end] as [number, number],
  });
  const leaf = (n: Node): Step => ({ ...base(n), note: "", reads: [], children: [] });

  const refs: Ref[] = [];
  const index = new Map<string, number>();
  const spans: { start: number; end: number; ref: number }[] = [];
  /** A range or cell step, with the index of its reference. `$A$2` and `A2` share one. */
  const reference = (n: Node & { type: "range" | "ref" }): Step => {
    const key = n.text.replaceAll("$", "").toUpperCase();
    let i = index.get(key);
    if (i === undefined) {
      i = refs.length;
      index.set(key, i);
      const box =
        n.type === "range"
          ? rangeBox(n.first, n.last, grid.size)
          : {
              top: n.address.row,
              bottom: n.address.row,
              left: n.address.col,
              right: n.address.col,
            };
      refs.push({ text: key, box });
    }
    spans.push({ start: n.start, end: n.end, ref: i });
    return { ...leaf(n), ref: i };
  };

  /** Adds "N of M cells match" to each criteria step, and returns the note for the call. */
  const conditional = (n: Node & { type: "call" }, steps: (Step | null)[]): string => {
    const spec = CONDITIONAL[n.name];
    if (!spec) return "";
    const pairs: { range: Value & RangeLike; at: number; test: (c: Scalar) => boolean }[] = [];
    for (let i = spec.pairsFrom; i + 1 < n.args.length; i += 2) {
      const range = evaluate(n.args[i] as Node, grid);
      const criteria = evaluate(n.args[i + 1] as Node, grid);
      if (!isRangeValue(range) || isRangeValue(criteria)) return "";
      pairs.push({ range, at: i + 1, test: criteriaMatcher(criteria as Scalar) });
    }
    const first = pairs[0]?.range;
    if (!first) return "";
    const height = first.rows.length;
    const width = first.rows[0]?.length ?? 0;
    const same = (r: RangeLike) => r.rows.length === height && (r.rows[0]?.length ?? 0) === width;
    if (!pairs.every((p) => same(p.range))) return "";
    const cells = (r: RangeLike) => r.rows.flat() as Scalar[];
    const total = height * width;
    for (const p of pairs) {
      const hits = cells(p.range).filter(p.test).length;
      const step = steps[p.at];
      const line = `${hits} of ${total} cells in ${text(n.args[p.at - 1] as Node)} match.`;
      if (step) step.note = step.note ? `${step.note} ${line}` : line;
    }
    const all = cells(first).map((_, k) => pairs.every((p) => p.test(cells(p.range)[k] ?? null)));
    const count = all.filter(Boolean).length;
    const unit = width === 1 ? "rows" : "cells";
    const rule = pairs.length === 1 ? "the condition" : "every condition";
    let line = `${count} of ${total} ${unit} meet ${rule}`;
    const targetNode = spec.target === undefined ? undefined : (n.args[spec.target] ?? n.args[0]);
    const target = targetNode ? evaluate(targetNode, grid) : undefined;
    if (target && isRangeValue(target) && same(target) && spec.join && count > 0 && count <= 6) {
      const picked = cells(target).filter((c, k) => all[k] && typeof c === "number");
      if (picked.length) line += `: ${picked.map((c) => formatValue(c)).join(spec.join)}`;
    }
    return `${line}.`;
  };

  /** Says which branch IF took. */
  const branch = (n: Node & { type: "call" }): string => {
    if (n.name !== "IF" || !n.args[0]) return "";
    const test = evaluate(n.args[0], grid);
    if (typeof test !== "boolean" && typeof test !== "number") return "";
    if (test !== false && test !== 0) return "The test is TRUE, so it returns the second argument.";
    return n.args.length > 2
      ? "The test is FALSE, so it returns the third argument."
      : "The test is FALSE and there is no third argument, so it returns FALSE.";
  };

  const build = (n: Node): Step | null => {
    switch (n.type) {
      case "call": {
        const syntax = syntaxes[n.name];
        const labels = syntax ? argLabels(syntax, n.args.length) : [];
        const steps = n.args.map((a, i) => {
          const step = build(a) ?? (LITERALS.has(a.type) ? leaf(a) : null);
          if (step && labels[i]) step.arg = labels[i];
          return step;
        });
        const extra = conditional(n, steps) || branch(n);
        const summary = summaries[n.name] ?? `Runs ${n.name} on its arguments.`;
        return {
          ...base(n),
          note: extra ? `${summary} ${extra}` : summary,
          reads: [],
          children: steps.filter((s): s is Step => s !== null),
        };
      }
      case "binary": {
        const [generic, specific] = OPS[n.op] ?? ["Combines the two sides.", undefined];
        // A big range shows as its size, which reads badly inside a sentence.
        const small = [n.left, n.right].every((s) => cellCount(evaluate(s, grid)) <= 6);
        return {
          ...base(n),
          note: specific && small ? specific(value(n.left), value(n.right)) : generic,
          reads: [],
          children: [build(n.left), build(n.right)].filter((s): s is Step => s !== null),
        };
      }
      case "unary":
        return {
          ...base(n),
          note: n.op === "-" ? "Changes the sign of the value." : "Keeps the value as it is.",
          reads: [],
          children: [build(n.operand)].filter((s): s is Step => s !== null),
        };
      case "percent":
        return {
          ...base(n),
          note: "Divides the value by 100.",
          reads: [],
          children: [build(n.operand)].filter((s): s is Step => s !== null),
        };
      case "range":
      case "ref":
        return reference(n);
      default:
        return null;
    }
  };

  const root = build(parsed.ast) ?? {
    ...leaf(parsed.ast),
    note: "A value typed straight into the formula.",
  };
  const mark = (step: Step): number[] => {
    const own = step.ref === undefined ? [] : [step.ref];
    step.reads = [...new Set([...own, ...step.children.flatMap(mark)])].sort((a, b) => a - b);
    return step.reads;
  };
  mark(root);

  const segments: Segment[] = [];
  let at = 0;
  for (const span of spans.sort((a, b) => a.start - b.start)) {
    if (span.start > at) segments.push({ text: source.slice(at, span.start) });
    segments.push({ text: source.slice(span.start, span.end), ref: span.ref });
    at = span.end;
  }
  if (at < source.length) segments.push({ text: source.slice(at) });

  return {
    ok: true,
    result: root.result,
    steps: root,
    error: isError(evaluate(parsed.ast, grid)),
    refs,
    formula: segments,
  };
}
