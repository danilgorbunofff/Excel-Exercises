// Why this exists: shared argument handling for the function library, so every
// function treats ranges, typed values, blanks and errors the same way.
import { type ErrorValue, errorValue, isError } from "../errors.ts";
import {
  type Arg,
  type FunctionImpl,
  type FunctionSpec,
  isRange,
  parseNumericText,
  type RangeValue,
  type Scalar,
  toBool,
  toNumber,
  toScalar,
  toText,
  type Value,
} from "../values.ts";

export const fn = (min: number, max: number, run: FunctionImpl): FunctionSpec => ({
  min,
  max,
  run,
});

/** Thrown inside a function to return an error value early. */
export class ExcelError extends Error {
  readonly value: ErrorValue;
  constructor(value: ErrorValue) {
    super(value.code);
    this.value = value;
  }
}
export const fail = (code: ErrorValue["code"]): never => {
  throw new ExcelError(errorValue(code));
};
/** Wraps a function body so early errors become return values. */
export const safe =
  (run: FunctionImpl): FunctionImpl =>
  (args) => {
    try {
      return run(args);
    } catch (e) {
      if (e instanceof ExcelError) return e.value;
      throw e;
    }
  };

export const cells = (r: RangeValue): Scalar[] => r.rows.flat();

/** A single value: a one-cell range gives its cell; an error is thrown. */
export function scalar(arg: Arg | undefined, fallback: Scalar = null): Scalar {
  if (!arg || arg.empty) return fallback;
  const v = toScalar(arg.get());
  if (isError(v)) throw new ExcelError(v);
  return v;
}
export function num(arg: Arg | undefined, fallback?: number): number {
  if ((!arg || arg.empty) && fallback !== undefined) return fallback;
  const v = toNumber(scalar(arg));
  if (isError(v)) throw new ExcelError(v);
  return v;
}
export function text(arg: Arg | undefined, fallback = ""): string {
  if (!arg) return fallback;
  const v = toText(scalar(arg));
  if (isError(v)) throw new ExcelError(v);
  return v;
}
export function bool(arg: Arg | undefined, fallback: boolean): boolean {
  if (!arg || arg.empty) return fallback;
  const v = toBool(scalar(arg));
  if (isError(v)) throw new ExcelError(v);
  return v;
}
/** A range argument. A single value becomes a one-cell range. */
export function range(arg: Arg | undefined): RangeValue {
  if (!arg) return fail("#VALUE!");
  const v: Value = arg.get();
  if (isRange(v)) return v;
  if (isError(v)) throw new ExcelError(v);
  return { kind: "range", origin: { col: 0, row: 0 }, rows: [[v]] };
}
/** A one-dimensional range as a list, or null if it has more than one row and column. */
export function vector(r: RangeValue): Scalar[] | null {
  if (r.rows.length === 1) return r.rows[0] ?? [];
  if (r.rows.every((row) => row.length === 1)) return r.rows.map((row) => row[0] ?? null);
  return null;
}

/**
 * The numbers an aggregate such as SUM works on. Numbers in ranges count;
 * text, logicals and blanks in ranges are skipped. Typed values are converted:
 * TRUE is 1, "3" is 3, and other text is #VALUE!. Errors anywhere are returned.
 */
export function numbersFrom(args: Arg[]): number[] {
  const out: number[] = [];
  for (const a of args) {
    if (a.empty) continue;
    const v = a.get();
    if (isRange(v)) {
      for (const c of cells(v)) {
        if (isError(c)) throw new ExcelError(c);
        if (typeof c === "number") out.push(c);
      }
      continue;
    }
    if (isError(v)) throw new ExcelError(v);
    if (typeof v === "number") out.push(v);
    else if (typeof v === "boolean") out.push(v ? 1 : 0);
    else if (typeof v === "string") {
      const n = parseNumericText(v);
      if (n === null) fail("#VALUE!");
      else out.push(n);
    }
  }
  return out;
}

/** Rounds n to d decimal places. mode: "half" away from zero, "up" away from zero, "down" toward zero. */
export function roundTo(n: number, d: number, mode: "half" | "up" | "down"): number {
  const digits = Math.trunc(d);
  const shift = (x: number, by: number) => {
    const [m, e = "0"] = x.toPrecision(15).split("e");
    return Number(`${m}e${Number(e) + by}`);
  };
  const scaled = shift(Math.abs(n), digits);
  const fixed =
    mode === "half"
      ? Math.floor(scaled + 0.5)
      : mode === "up"
        ? Math.ceil(scaled)
        : Math.floor(scaled);
  const back = shift(fixed, -digits);
  return n < 0 ? -back : back;
}
