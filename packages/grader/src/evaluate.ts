// Why this exists: computes a parsed formula against the exercise sheet with
// Excel's rules for operators, types and errors. Pure and deterministic: the
// same formula on the same sheet, with the same options.today, always gives
// the same value.
import type { Address } from "./address.ts";
import { errorValue, isError } from "./errors.ts";
import { FUNCTIONS } from "./functions/index.ts";
import { LIFTED } from "./functions/lifted.ts";
import type { Grid } from "./grid.ts";
import { type Node, parse } from "./parse.ts";
import { expandRange } from "./range.ts";
import {
  type Arg,
  array,
  cellAt,
  compare,
  isRange,
  lift1,
  lift2,
  type RangeValue,
  type Scalar,
  toNumber,
  toScalar,
  toText,
  type Value,
} from "./values.ts";

export interface EvaluateOptions {
  /** The cell the formula is written in. Excel would call reading it circular; here it reads as empty. */
  cell?: Address;
  /** The date TODAY() returns, in local time. Defaults to now; set it for repeatable results. */
  today?: Date;
}

export function evaluate(node: Node, grid: Grid, options: EvaluateOptions = {}): Value {
  const cell = (a: Address): Scalar =>
    options.cell && options.cell.col === a.col && options.cell.row === a.row ? null : grid.get(a);

  const rangeOf = (n: Extract<Node, { type: "range" }>): RangeValue => {
    const rows = expandRange(n.first, n.last, grid.size);
    return {
      kind: "range",
      origin: rows[0]?.[0] ?? { col: 1, row: 1 },
      rows: rows.map((r) => r.map(cell)),
    };
  };

  /** Names that LET has bound, keyed in upper case. */
  const names = new Map<string, Value>();

  /** A value for an operator: one cell stays a value, a larger range or array is lifted cell by cell. */
  const operand = (n: Node): Value => {
    const v = run(n);
    return isRange(v) && !(v.rows.length === 1 && v.rows[0]?.length === 1) ? v : toScalar(v);
  };

  const run = (n: Node): Value => {
    switch (n.type) {
      case "number":
      case "string":
      case "bool":
        return n.value;
      case "error":
        return errorValue(n.code);
      case "array":
        return array(n.rows.map((r) => [...r]));
      case "empty":
        return null;
      case "name":
        return names.get(n.name.toUpperCase()) ?? errorValue("#NAME?");
      case "ref":
        // LET may bind a name that looks like a cell, such as a1; Excel then reads the name.
        return names.get(n.text.toUpperCase()) ?? cell(n.address);
      case "range":
        return rangeOf(n);
      case "call": {
        if (n.name === "LET") return letOf(n.args);
        const impl = FUNCTIONS[n.name];
        if (!impl) return errorValue("#NAME?");
        // A single cell passed to a function behaves like a one-cell range, so
        // SUM(A1) skips text in A1 while SUM("x") is #VALUE!, as in Excel.
        const argOf = (a: Node, value?: Value): Arg => ({
          empty: a.type === "empty",
          get: () =>
            value !== undefined
              ? value
              : a.type === "ref"
                ? { kind: "range", origin: a.address, rows: [[cell(a.address)]] }
                : run(a),
        });
        // Arguments Excel takes one value at a time: a range there runs the
        // function once per cell, and the results spill.
        const many = new Map<number, Scalar[][]>();
        const once = new Map<number, Value>();
        for (const i of LIFTED[n.name]?.(n.args.length) ?? []) {
          const a = n.args[i];
          if (!a || a.type === "empty" || a.type === "ref") continue;
          const v = run(a);
          if (isRange(v) && v.rows.length * (v.rows[0]?.length ?? 0) > 1) many.set(i, v.rows);
          else once.set(i, v);
        }
        if (many.size === 0)
          return impl.run(
            n.args.map((a, i) => argOf(a, once.get(i))),
            options,
          );
        const blocks = [...many.values()];
        const h = Math.max(...blocks.map((b) => b.length));
        const w = Math.max(...blocks.map((b) => b[0]?.length ?? 0));
        return array(
          Array.from({ length: h }, (_, r) =>
            Array.from({ length: w }, (_, c) => {
              const args = n.args.map((a, i) => {
                const rows = many.get(i);
                return argOf(a, rows ? cellAt(rows, r, c) : once.get(i));
              });
              return toScalar(impl.run(args, options));
            }),
          ),
        );
      }
      case "unary":
        return lift1(operand(n.operand), (s) => {
          const v = toNumber(s);
          if (isError(v)) return v;
          return n.op === "-" ? -v : v;
        });
      case "percent":
        return lift1(operand(n.operand), (s) => {
          const v = toNumber(s);
          return isError(v) ? v : v / 100;
        });
      case "binary":
        return lift2(operand(n.left), operand(n.right), (a, b) => binary(n.op, a, b));
    }
  };

  /** LET(name1, value1, [name2, value2, ...], calculation). Each value can use the names before it. */
  const letOf = (args: Node[]): Value => {
    if (args.length < 3 || args.length % 2 === 0) return errorValue("#VALUE!");
    const saved = new Map(names);
    try {
      for (let i = 0; i + 1 < args.length; i += 2) {
        const name = args[i];
        const value = args[i + 1];
        const key =
          name?.type === "name"
            ? name.name
            : name?.type === "ref" && !name.text.includes("$")
              ? name.text
              : null;
        if (key === null || !value) return errorValue("#VALUE!");
        names.set(key.toUpperCase(), run(value));
      }
      return run(args[args.length - 1] as Node);
    } finally {
      names.clear();
      for (const [k, v] of saved) names.set(k, v);
    }
  };

  const result = run(node);
  if (isRange(result)) {
    const only = toScalar(result);
    return isError(only) ? result : only === null ? 0 : only;
  }
  return result === null ? 0 : result;
}

function binary(op: Extract<Node, { type: "binary" }>["op"], a: Scalar, b: Scalar): Scalar {
  if (isError(a)) return a;
  if (isError(b)) return b;
  if (op === "&") {
    return `${toText(a)}${toText(b)}`;
  }
  if (op === "=" || op === "<>" || op === "<" || op === ">" || op === "<=" || op === ">=") {
    const c = compare(a, b);
    return { "=": c === 0, "<>": c !== 0, "<": c < 0, ">": c > 0, "<=": c <= 0, ">=": c >= 0 }[op];
  }
  const x = toNumber(a);
  if (isError(x)) return x;
  const y = toNumber(b);
  if (isError(y)) return y;
  switch (op) {
    case "+":
      return x + y;
    case "-":
      return x - y;
    case "*":
      return x * y;
    case "/":
      return y === 0 ? errorValue("#DIV/0!") : x / y;
    case "^": {
      if (x === 0 && y === 0) return errorValue("#NUM!");
      const r = x ** y;
      return Number.isFinite(r) ? r : errorValue(x === 0 ? "#DIV/0!" : "#NUM!");
    }
  }
}

/** Parses and evaluates in one step. A syntax error gives #NAME?, as close to Excel as a value can be. */
export function evaluateFormula(formula: string, grid: Grid, cell?: Address): Value {
  const r = parse(formula);
  if (!r.ok) return errorValue("#NAME?");
  return evaluate(r.ast, grid, cell ? { cell } : {});
}
