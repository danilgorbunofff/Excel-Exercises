// Why this exists: functions that rank or pick from a list of numbers, and the
// two code-driven totals. SUBTOTAL and AGGREGATE take a number that names the
// function to run. The sheets here have no hidden rows, so SUBTOTAL's 101 to
// 111 codes give the same results as 1 to 11.
import type { Arg, FunctionSpec } from "../values.ts";
import { cells, fail, fn, num, numbersFrom, range, safe } from "./helpers.ts";
import { MATH } from "./math.ts";

/** The numbers in a range argument; text, logicals and blanks are skipped. */
const numbersIn = (arg: Arg | undefined): number[] =>
  cells(range(arg)).filter((c): c is number => typeof c === "number");

function nth(arg: Arg | undefined, k: Arg | undefined, order: 1 | -1): number {
  const xs = numbersIn(arg).sort((a, b) => order * (a - b));
  const at = Math.ceil(num(k));
  if (at < 1 || at > xs.length) return fail("#NUM!");
  return xs[at - 1] as number;
}

function mode(args: Arg[]): number {
  const counts = new Map<number, number>();
  let best: number | null = null;
  let bestCount = 1;
  for (const x of numbersFrom(args)) {
    const n = (counts.get(x) ?? 0) + 1;
    counts.set(x, n);
    if (n > bestCount) {
      best = x;
      bestCount = n;
    }
  }
  return best ?? fail("#N/A");
}

function spread(args: Arg[], sample: boolean, root: boolean): number {
  const xs = numbersFrom(args);
  if (xs.length < (sample ? 2 : 1)) return fail("#DIV/0!");
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const squares = xs.reduce((a, b) => a + (b - mean) ** 2, 0);
  const variance = squares / (sample ? xs.length - 1 : xs.length);
  return root ? Math.sqrt(variance) : variance;
}

const run = (name: string, args: Arg[]) => (MATH[name] ?? fail("#VALUE!")).run(args);

/** Codes 1 to 11, shared by SUBTOTAL and AGGREGATE. */
function byCode(code: number, args: Arg[]) {
  switch (code) {
    case 1:
      return run("AVERAGE", args);
    case 2:
      return run("COUNT", args);
    case 3:
      return run("COUNTA", args);
    case 4:
      return run("MAX", args);
    case 5:
      return run("MIN", args);
    case 6:
      return run("PRODUCT", args);
    case 7:
      return spread(args, true, true);
    case 8:
      return spread(args, false, true);
    case 9:
      return run("SUM", args);
    case 10:
      return spread(args, true, false);
    case 11:
      return spread(args, false, false);
    default:
      return fail("#VALUE!");
  }
}

export const STATS: Record<string, FunctionSpec> = {
  LARGE: fn(
    2,
    2,
    safe((args) => nth(args[0], args[1], -1)),
  ),
  SMALL: fn(
    2,
    2,
    safe((args) => nth(args[0], args[1], 1)),
  ),
  RANK: fn(
    2,
    3,
    safe((args) => {
      const x = num(args[0]);
      const xs = numbersIn(args[1]);
      if (!xs.includes(x)) return fail("#N/A");
      const ascending = num(args[2], 0) !== 0;
      return xs.filter((v) => (ascending ? v < x : v > x)).length + 1;
    }),
  ),
  MODE: fn(1, 255, safe(mode)),
  SUBTOTAL: fn(
    2,
    255,
    safe((args) => {
      const code = Math.trunc(num(args[0]));
      return byCode(code > 100 ? code - 100 : code, args.slice(1));
    }),
  ),
  AGGREGATE: fn(
    3,
    253,
    safe((args) => {
      const code = Math.trunc(num(args[0]));
      const options = Math.trunc(num(args[1]));
      if (options < 0 || options > 7) return fail("#VALUE!");
      const rest = args.slice(2);
      if (code === 12) return run("MEDIAN", rest);
      if (code === 13) return mode(rest);
      if (code === 14 || code === 15) {
        if (rest.length !== 2) return fail("#VALUE!");
        return nth(rest[0], rest[1], code === 14 ? -1 : 1);
      }
      return byCode(code, rest);
    }),
  ),
};
