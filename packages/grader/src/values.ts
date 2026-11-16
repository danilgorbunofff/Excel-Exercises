// Why this exists: the value types a formula works with, and Excel's rules for
// turning one type into another (text to number, blank to zero and so on).
import type { Address } from "./address.ts";
import { type ErrorValue, errorValue, isError } from "./errors.ts";
import type { EvaluateOptions } from "./evaluate.ts";

/** A single cell value. null is an empty cell. */
export type Scalar = number | string | boolean | null | ErrorValue;

/** A rectangular block of cells, as passed to functions such as SUM. */
export interface RangeValue {
  kind: "range";
  /** Rows of values, top to bottom. */
  rows: Scalar[][];
  /** The address of the top-left cell. */
  origin: Address;
}

export type Value = Scalar | RangeValue;

/** A function argument. empty is true for a gap such as the middle of IF(A1,,1). */
export interface Arg {
  get: () => Value;
  empty: boolean;
}

/** `options` reaches the few functions that read outside the sheet, such as TODAY. */
export type FunctionImpl = (args: Arg[], options?: EvaluateOptions) => Value;

/** A function the grader knows: how many arguments it takes, and what it does. */
export interface FunctionSpec {
  min: number;
  max: number;
  run: FunctionImpl;
}

export { errorValue, isError };

export function isRange(v: Value): v is RangeValue {
  return typeof v === "object" && v !== null && (v as RangeValue).kind === "range";
}

/** A computed array, such as FILTER's result. It has no place on the sheet. */
export const array = (rows: Scalar[][]): RangeValue => ({
  kind: "range",
  origin: { col: 0, row: 0 },
  rows,
});

/** Any value as rows of cells: a single value is one row of one cell. */
export const rowsOf = (v: Value): Scalar[][] => (isRange(v) ? v.rows : [[v]]);

/** A single value from a range: a one-cell range gives its cell, larger ones #VALUE!. */
export function toScalar(v: Value): Scalar {
  if (!isRange(v)) return v;
  if (v.rows.length === 1 && v.rows[0]?.length === 1) return v.rows[0][0] ?? null;
  return errorValue("#VALUE!");
}

const NUMERIC_TEXT = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?%?$/u;

/** Text that Excel would read as a number, or null. */
export function parseNumericText(text: string): number | null {
  const t = text.trim();
  if (t === "" || !/\d/u.test(t) || !NUMERIC_TEXT.test(t)) return null;
  const percent = t.endsWith("%");
  const n = Number(t.replace(/[,%]/gu, ""));
  if (!Number.isFinite(n)) return null;
  return percent ? n / 100 : n;
}

export function toNumber(v: Scalar): number | ErrorValue {
  if (isError(v)) return v;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null) return 0;
  return parseNumericText(v) ?? errorValue("#VALUE!");
}

/** Excel's General number format, used when a number becomes text. */
export function formatNumber(n: number): string {
  if (n === 0 || Object.is(n, -0)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-9) {
    const [mantissa, exp] = Number(n.toPrecision(15)).toExponential().split("e") as [
      string,
      string,
    ];
    const e = Number(exp);
    return `${mantissa}E${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`;
  }
  const rounded = Number(n.toPrecision(15));
  if (Number.isInteger(rounded)) return String(rounded);
  const decimals = Math.min(20, Math.max(0, 14 - Math.floor(Math.log10(abs))));
  return rounded.toFixed(decimals).replace(/0+$/u, "").replace(/\.$/u, "");
}

export function toText(v: Scalar): string | ErrorValue {
  if (isError(v)) return v;
  if (v === null) return "";
  if (typeof v === "number") return formatNumber(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return v;
}

export function toBool(v: Scalar): boolean | ErrorValue {
  if (isError(v)) return v;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null) return false;
  const t = v.trim().toUpperCase();
  if (t === "TRUE") return true;
  if (t === "FALSE") return false;
  return errorValue("#VALUE!");
}

const rank = (v: number | string | boolean) =>
  typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2;

/**
 * Excel's comparison: -1, 0 or 1. A blank takes the type of the other side.
 * Errors must be handled by the caller.
 */
export function compare(
  a: Exclude<Scalar, ErrorValue>,
  b: Exclude<Scalar, ErrorValue>,
): -1 | 0 | 1 {
  const blankAs = (other: Exclude<Scalar, ErrorValue>) =>
    typeof other === "string" ? "" : typeof other === "boolean" ? false : 0;
  const x = a === null ? blankAs(b) : a;
  const y = b === null ? blankAs(a) : b;
  if (x === null || y === null) return 0;
  if (rank(x) !== rank(y)) return rank(x) < rank(y) ? -1 : 1;
  if (typeof x === "string" && typeof y === "string") {
    const p = x.toLowerCase();
    const q = y.toLowerCase();
    return p < q ? -1 : p > q ? 1 : 0;
  }
  const p = Number(x);
  const q = Number(y);
  // Excel compares numbers to 15 significant digits, so 0.1+0.2=0.3 is TRUE.
  if (p === q || Number(p.toPrecision(15)) === Number(q.toPrecision(15))) return 0;
  return p < q ? -1 : 1;
}

/**
 * Cell (i, j) of rows stretched to a larger size: a single row or column
 * repeats; past the end of a longer side the cell is #N/A, as in Excel.
 */
export function cellAt(rows: Scalar[][], i: number, j: number): Scalar {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const r = h === 1 ? 0 : i;
  const c = w === 1 ? 0 : j;
  return r < h && c < w ? (rows[r]?.[c] ?? null) : errorValue("#N/A");
}

/** Applies f to a value, or to each cell of an array. */
export function lift1(v: Value, f: (s: Scalar) => Scalar): Value {
  if (!isRange(v)) return f(v);
  return array(v.rows.map((row) => row.map(f)));
}

/**
 * Applies f cell by cell, as Excel does for =A2:A5*B2:B5. A single row or
 * column stretches to fit the other side; cells beyond a shorter side are #N/A.
 */
export function lift2(a: Value, b: Value, f: (x: Scalar, y: Scalar) => Scalar): Value {
  if (!isRange(a) && !isRange(b)) return f(a, b);
  const ra = isRange(a) ? a.rows : [[a]];
  const rb = isRange(b) ? b.rows : [[b]];
  const ha = ra.length;
  const hb = rb.length;
  const wa = ra[0]?.length ?? 0;
  const wb = rb[0]?.length ?? 0;
  return array(
    Array.from({ length: Math.max(ha, hb) }, (_, i) =>
      Array.from({ length: Math.max(wa, wb) }, (_, j) => f(cellAt(ra, i, j), cellAt(rb, i, j))),
    ),
  );
}
