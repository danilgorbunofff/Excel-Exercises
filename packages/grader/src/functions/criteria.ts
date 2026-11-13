// Why this exists: Excel's criteria strings for SUMIF, COUNTIF and the -IFS
// family: ">100", "<>West", "a*", "" and so on, with * and ? wildcards and ~
// to escape them. Text matches ignore case.
import { isError } from "../errors.ts";
import {
  type Arg,
  type FunctionSpec,
  parseNumericText,
  type RangeValue,
  type Scalar,
} from "../values.ts";
import { ExcelError, fail, fn, range, safe, scalar } from "./helpers.ts";

type Op = "=" | "<>" | "<" | ">" | "<=" | ">=";

/** Turns a wildcard pattern into a regular expression that matches the whole text. */
export function wildcardRegExp(pattern: string): RegExp {
  let src = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i] as string;
    if (ch === "~" && i + 1 < pattern.length && "*?~".includes(pattern[i + 1] as string)) {
      src += `\\${pattern[++i]}`;
    } else if (ch === "*") src += "[\\s\\S]*";
    else if (ch === "?") src += "[\\s\\S]";
    else src += ch.replace(/[.*+?^${}()|[\]\\/]/gu, "\\$&");
  }
  return new RegExp(`^${src}$`, "iu");
}

const cmp = (op: Op, c: number) =>
  ({ "=": c === 0, "<>": c !== 0, "<": c < 0, ">": c > 0, "<=": c <= 0, ">=": c >= 0 })[op];

/** Returns a test for one cell, built from a criteria value. */
export function criteriaMatcher(criteria: Scalar): (cell: Scalar) => boolean {
  if (isError(criteria)) return (c) => isError(c) && c === criteria;
  if (typeof criteria === "number") {
    return (c) =>
      typeof c === "number"
        ? c === criteria
        : typeof c === "string" && parseNumericText(c) === criteria;
  }
  if (typeof criteria === "boolean") return (c) => c === criteria;
  const raw = criteria ?? "";
  const m = /^(<=|>=|<>|=|<|>)?([\s\S]*)$/u.exec(raw) as RegExpExecArray;
  const op = (m[1] ?? "=") as Op;
  const rest = m[2] ?? "";
  const blank = (c: Scalar) => c === null || c === "";

  if (rest === "") {
    if (op === "=") return m[1] ? (c) => c === null : blank;
    if (op === "<>") return (c) => c !== null;
    return () => false;
  }
  const n = parseNumericText(rest);
  if (n !== null) {
    return (c) => {
      const v =
        typeof c === "number"
          ? c
          : op === "=" && typeof c === "string"
            ? parseNumericText(c)
            : null;
      if (v === null) return op === "<>";
      return cmp(op, v < n ? -1 : v > n ? 1 : 0);
    };
  }
  if (/^(TRUE|FALSE)$/iu.test(rest)) {
    const b = rest.toUpperCase() === "TRUE";
    return (c) => (typeof c === "boolean" ? cmp(op, Number(c) - Number(b)) : op === "<>");
  }
  if (op === "=" || op === "<>") {
    const re = wildcardRegExp(rest);
    return (c) => {
      const hit = typeof c === "string" && re.test(c);
      return op === "=" ? hit : !hit;
    };
  }
  const t = rest.toLowerCase();
  return (c) => {
    if (typeof c !== "string") return false;
    const v = c.toLowerCase();
    return cmp(op, v < t ? -1 : v > t ? 1 : 0);
  };
}

const sameShape = (a: RangeValue, b: RangeValue) =>
  a.rows.length === b.rows.length && (a.rows[0]?.length ?? 0) === (b.rows[0]?.length ?? 0);

/** Positions (row, column) where every criteria pair matches. */
function matches(pairs: [RangeValue, Scalar][]): [number, number][] {
  const first = pairs[0]?.[0];
  if (!first) return [];
  if (pairs.some(([r]) => !sameShape(r, first))) fail("#VALUE!");
  const tests = pairs.map(([r, c]) => [r, criteriaMatcher(c)] as const);
  const out: [number, number][] = [];
  first.rows.forEach((row, i) => {
    row.forEach((_, j) => {
      if (tests.every(([r, t]) => t(r.rows[i]?.[j] ?? null))) out.push([i, j]);
    });
  });
  return out;
}

/** The numbers at the matched positions of the sum range. Text is skipped; errors are returned. */
function pick(target: RangeValue, at: [number, number][]): number[] {
  const out: number[] = [];
  for (const [i, j] of at) {
    const c = target.rows[i]?.[j] ?? null;
    if (isError(c)) throw new ExcelError(c);
    if (typeof c === "number") out.push(c);
  }
  return out;
}

const pairsFrom = (args: Arg[], offset: number): [RangeValue, Scalar][] => {
  const pairs: [RangeValue, Scalar][] = [];
  for (let i = offset; i < args.length; i += 2) pairs.push([range(args[i]), scalar(args[i + 1])]);
  return pairs;
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : fail("#DIV/0!"));

export const CRITERIA: Record<string, FunctionSpec> = {
  COUNTIF: fn(
    2,
    2,
    safe((args) => matches([[range(args[0]), scalar(args[1])]]).length),
  ),
  COUNTIFS: fn(
    2,
    254,
    safe((args) => (args.length % 2 ? fail("#VALUE!") : matches(pairsFrom(args, 0)).length)),
  ),
  SUMIF: fn(
    2,
    3,
    safe((args) => {
      const r = range(args[0]);
      const at = matches([[r, scalar(args[1])]]);
      return sum(pick(args[2] && !args[2].empty ? range(args[2]) : r, at));
    }),
  ),
  SUMIFS: fn(
    3,
    255,
    safe((args) => {
      if (args.length % 2 === 0) return fail("#VALUE!");
      const target = range(args[0]);
      const pairs = pairsFrom(args, 1);
      if (pairs.some(([r]) => !sameShape(r, target))) return fail("#VALUE!");
      return sum(pick(target, matches(pairs)));
    }),
  ),
  AVERAGEIF: fn(
    2,
    3,
    safe((args) => {
      const r = range(args[0]);
      const at = matches([[r, scalar(args[1])]]);
      return mean(pick(args[2] && !args[2].empty ? range(args[2]) : r, at));
    }),
  ),
  AVERAGEIFS: fn(
    3,
    255,
    safe((args) => {
      if (args.length % 2 === 0) return fail("#VALUE!");
      const target = range(args[0]);
      const pairs = pairsFrom(args, 1);
      if (pairs.some(([r]) => !sameShape(r, target))) return fail("#VALUE!");
      return mean(pick(target, matches(pairs)));
    }),
  ),
};
