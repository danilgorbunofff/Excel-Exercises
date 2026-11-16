// Why this exists: computes a parsed formula against the exercise sheet with
// Excel's rules for operators, types and errors. Pure and deterministic: the
// same formula on the same sheet, with the same options.today, always gives
// the same value.
import type { Address } from "./address.ts";
import { errorValue, isError } from "./errors.ts";
import { FUNCTIONS } from "./functions/index.ts";
import type { Grid } from "./grid.ts";
import { type Node, parse } from "./parse.ts";
import { expandRange } from "./range.ts";
import {
  type Arg,
  compare,
  isRange,
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

  /** A value in a single-value position. Ranges must be one cell; blanks stay blank, so "a"&blank is "a". */
  const scalarOf = (n: Node): Scalar => toScalar(run(n));

  const run = (n: Node): Value => {
    switch (n.type) {
      case "number":
      case "string":
      case "bool":
        return n.value;
      case "error":
        return errorValue(n.code);
      case "empty":
        return null;
      case "name":
        return errorValue("#NAME?");
      case "ref":
        return cell(n.address);
      case "range":
        return rangeOf(n);
      case "call": {
        const impl = FUNCTIONS[n.name];
        if (!impl) return errorValue("#NAME?");
        // A single cell passed to a function behaves like a one-cell range, so
        // SUM(A1) skips text in A1 while SUM("x") is #VALUE!, as in Excel.
        const args: Arg[] = n.args.map((a) => ({
          empty: a.type === "empty",
          get: () =>
            a.type === "ref"
              ? { kind: "range", origin: a.address, rows: [[cell(a.address)]] }
              : run(a),
        }));
        return impl.run(args, options);
      }
      case "unary": {
        const v = toNumber(scalarOf(n.operand));
        if (isError(v)) return v;
        return n.op === "-" ? -v : v;
      }
      case "percent": {
        const v = toNumber(scalarOf(n.operand));
        return isError(v) ? v : v / 100;
      }
      case "binary":
        return binary(n.op, scalarOf(n.left), scalarOf(n.right));
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
