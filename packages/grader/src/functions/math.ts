// Why this exists: SUM, AVERAGE, COUNT and the other number functions, with
// Excel's rules for what each one counts and skips.
import { isError } from "../errors.ts";
import { type FunctionSpec, isRange, parseNumericText } from "../values.ts";
import { cells, fail, fn, num, numbersFrom, range, roundTo, safe } from "./helpers.ts";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Drops floating point noise, so 7 * 0.2 is 1.4 and not 1.4000000000000001. */
const clean = (x: number) => (x === 0 ? 0 : Number(x.toPrecision(15)));

/**
 * Rounds to a multiple of step. A negative step rounds a negative number by
 * its size: FLOOR(-2.5,-2) is -2 and CEILING(-2.5,-2) is -4. A positive number
 * with a negative step is #NUM!.
 */
function toMultiple(n: number, step: number, pick: (x: number) => number): number {
  if (n === 0) return 0;
  if (step > 0) return clean(pick(clean(n / step)) * step);
  if (n > 0) return fail("#NUM!");
  return clean(-pick(clean(n / step)) * -step);
}

/**
 * ODD (parity 1) and EVEN (parity 0): round away from zero to the next whole
 * number with that parity. Zero counts as positive, so ODD(0) is 1.
 */
function awayToParity(n: number, parity: 0 | 1): number {
  const up = Math.ceil(clean(Math.abs(n)));
  return (n < 0 ? -1 : 1) * (up % 2 === parity ? up : up + 1);
}

export const MATH: Record<string, FunctionSpec> = {
  SQRT: fn(
    1,
    1,
    safe((args) => {
      const x = num(args[0]);
      return x < 0 ? fail("#NUM!") : Math.sqrt(x);
    }),
  ),
  POWER: fn(
    2,
    2,
    safe((args) => {
      const x = num(args[0]);
      const y = num(args[1]);
      if (x === 0 && y === 0) return fail("#NUM!");
      const r = x ** y;
      return Number.isFinite(r) ? r : fail(x === 0 ? "#DIV/0!" : "#NUM!");
    }),
  ),
  SUM: fn(
    1,
    255,
    safe((args) => sum(numbersFrom(args))),
  ),
  AVERAGE: fn(
    1,
    255,
    safe((args) => {
      const xs = numbersFrom(args);
      return xs.length ? sum(xs) / xs.length : fail("#DIV/0!");
    }),
  ),
  MIN: fn(
    1,
    255,
    safe((args) => {
      const xs = numbersFrom(args);
      return xs.length ? Math.min(...xs) : 0;
    }),
  ),
  MAX: fn(
    1,
    255,
    safe((args) => {
      const xs = numbersFrom(args);
      return xs.length ? Math.max(...xs) : 0;
    }),
  ),
  MEDIAN: fn(
    1,
    255,
    safe((args) => {
      const xs = numbersFrom(args).sort((a, b) => a - b);
      if (!xs.length) return fail("#NUM!");
      const mid = Math.floor(xs.length / 2);
      return xs.length % 2
        ? (xs[mid] as number)
        : ((xs[mid - 1] as number) + (xs[mid] as number)) / 2;
    }),
  ),
  PRODUCT: fn(
    1,
    255,
    safe((args) => {
      const xs = numbersFrom(args);
      return xs.length ? xs.reduce((a, b) => a * b, 1) : 0;
    }),
  ),
  // COUNT counts numbers. In ranges only real numbers count; typed logicals
  // and numbers written as text count too. Errors are never counted.
  COUNT: fn(1, 255, (args) => {
    let n = 0;
    for (const a of args) {
      if (a.empty) continue;
      const v = a.get();
      if (isRange(v)) n += cells(v).filter((c) => typeof c === "number").length;
      else if (typeof v === "number" || typeof v === "boolean") n++;
      else if (typeof v === "string" && parseNumericText(v) !== null) n++;
    }
    return n;
  }),
  // COUNTA counts every cell that is not empty, including text, errors and "".
  COUNTA: fn(1, 255, (args) => {
    let n = 0;
    for (const a of args) {
      if (a.empty) continue;
      const v = a.get();
      if (isRange(v)) n += cells(v).filter((c) => c !== null).length;
      else n++;
    }
    return n;
  }),
  COUNTBLANK: fn(
    1,
    1,
    safe((args) => cells(range(args[0])).filter((c) => c === null || c === "").length),
  ),
  ROUND: fn(
    2,
    2,
    safe((args) => roundTo(num(args[0]), num(args[1]), "half")),
  ),
  ROUNDUP: fn(
    2,
    2,
    safe((args) => roundTo(num(args[0]), num(args[1]), "up")),
  ),
  ROUNDDOWN: fn(
    2,
    2,
    safe((args) => roundTo(num(args[0]), num(args[1]), "down")),
  ),
  MROUND: fn(
    2,
    2,
    safe((args) => {
      const n = num(args[0]);
      const step = num(args[1]);
      if (n === 0 || step === 0) return 0;
      if (Math.sign(n) !== Math.sign(step)) return fail("#NUM!");
      return clean(Math.sign(n) * Math.round(clean(Math.abs(n / step))) * Math.abs(step));
    }),
  ),
  FLOOR: fn(
    2,
    2,
    safe((args) => {
      const step = num(args[1]);
      return step === 0 ? fail("#DIV/0!") : toMultiple(num(args[0]), step, Math.floor);
    }),
  ),
  CEILING: fn(
    2,
    2,
    safe((args) => {
      const step = num(args[1]);
      return step === 0 ? 0 : toMultiple(num(args[0]), step, Math.ceil);
    }),
  ),
  ABS: fn(
    1,
    1,
    safe((args) => Math.abs(num(args[0]))),
  ),
  INT: fn(
    1,
    1,
    safe((args) => Math.floor(num(args[0]))),
  ),
  ODD: fn(
    1,
    1,
    safe((args) => awayToParity(num(args[0]), 1)),
  ),
  EVEN: fn(
    1,
    1,
    safe((args) => awayToParity(num(args[0]), 0)),
  ),
  MOD: fn(
    2,
    2,
    safe((args) => {
      const n = num(args[0]);
      const d = num(args[1]);
      if (d === 0) return fail("#DIV/0!");
      return n - d * Math.floor(n / d);
    }),
  ),
  SUMPRODUCT: fn(
    1,
    255,
    safe((args) => {
      const ranges = args.map((a) => range(a));
      const first = ranges[0];
      if (!first) return fail("#VALUE!");
      const h = first.rows.length;
      const w = first.rows[0]?.length ?? 0;
      if (ranges.some((r) => r.rows.length !== h || (r.rows[0]?.length ?? 0) !== w))
        return fail("#VALUE!");
      let total = 0;
      for (let i = 0; i < h; i++) {
        for (let j = 0; j < w; j++) {
          let p = 1;
          for (const r of ranges) {
            const c = r.rows[i]?.[j] ?? null;
            if (isError(c)) return c;
            p *= typeof c === "number" ? c : 0;
          }
          total += p;
        }
      }
      return total;
    }),
  ),
};
