// Why this exists: the formula explainer. It parses a formula with the grader,
// then evaluates every function call and operation inside it on its own, so
// each part can be shown with the value it works out to. Pure, so it is
// unit-tested and runs the same at build time and in the browser.
import {
  type CellInput,
  createGrid,
  evaluate,
  formatValue,
  type Node,
  parse,
  type Value,
} from "@practice/grader";

export interface Step {
  /** The part of the formula this step is about, as typed. */
  text: string;
  /** What it works out to, as a cell would show it. */
  result: string;
  /** One line saying what this part does. */
  note: string;
  children: Step[];
}

export type Explained =
  | { ok: true; result: string; steps: Step }
  | { ok: false; message: string; at: number };

const OPS: Record<string, string> = {
  "+": "Adds the two sides.",
  "-": "Subtracts the right side from the left.",
  "*": "Multiplies the two sides.",
  "/": "Divides the left side by the right.",
  "^": "Raises the left side to the power of the right.",
  "&": "Joins the two sides into one piece of text.",
  "=": "Tests whether the two sides are equal.",
  "<>": "Tests whether the two sides differ.",
  "<": "Tests whether the left side is smaller.",
  ">": "Tests whether the left side is larger.",
  "<=": "Tests whether the left side is smaller or equal.",
  ">=": "Tests whether the left side is larger or equal.",
};

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

/** Explains a formula against a sheet. `summaries` names what each function does. */
export function explain(
  formula: string,
  rows: readonly (readonly CellInput[])[],
  summaries: Readonly<Record<string, string>> = {},
): Explained {
  const source = formula.trim().startsWith("=") ? formula.trim() : `=${formula.trim()}`;
  const parsed = parse(source);
  if (!parsed.ok) {
    return { ok: false, message: parsed.error.message, at: parsed.error.start };
  }
  const grid = createGrid(rows);
  const value = (n: Node) => describeValue(evaluate(n, grid));
  const text = (n: Node) => source.slice(n.start, n.end);

  const build = (n: Node): Step | null => {
    switch (n.type) {
      case "call":
        return {
          text: text(n),
          result: value(n),
          note: summaries[n.name] ?? `Runs ${n.name} on its arguments.`,
          children: n.args.map(build).filter((s): s is Step => s !== null),
        };
      case "binary":
        return {
          text: text(n),
          result: value(n),
          note: OPS[n.op] ?? "Combines the two sides.",
          children: [build(n.left), build(n.right)].filter((s): s is Step => s !== null),
        };
      case "unary":
        return {
          text: text(n),
          result: value(n),
          note: n.op === "-" ? "Turns the value negative." : "Keeps the value as it is.",
          children: [build(n.operand)].filter((s): s is Step => s !== null),
        };
      case "percent":
        return {
          text: text(n),
          result: value(n),
          note: "Divides the value by 100.",
          children: [build(n.operand)].filter((s): s is Step => s !== null),
        };
      case "range":
        return { text: text(n), result: value(n), note: "Reads a block of cells.", children: [] };
      case "ref":
        return {
          text: text(n),
          result: value(n),
          note: `Reads cell ${n.text.replaceAll("$", "")}.`,
          children: [],
        };
      default:
        return null;
    }
  };

  const root = build(parsed.ast) ?? {
    text: text(parsed.ast),
    result: value(parsed.ast),
    note: "A value typed straight into the formula.",
    children: [],
  };
  return { ok: true, result: root.result, steps: root };
}
