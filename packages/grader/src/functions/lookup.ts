// Why this exists: VLOOKUP, HLOOKUP, XLOOKUP, MATCH and INDEX. Exact matches
// ignore case and, where Excel allows, use wildcards. A number never matches
// text that looks like a number, which is the commonest cause of #N/A.
// Approximate matches assume sorted data, as Excel does.
import { isError } from "../errors.ts";
import { compare, type FunctionSpec, type RangeValue, type Scalar, type Value } from "../values.ts";
import { wildcardRegExp } from "./criteria.ts";
import { bool, fail, fn, num, range, safe, scalar, vector } from "./helpers.ts";

type Plain = Exclude<Scalar, { kind: "error" }>;
const kind = (v: Scalar) => (v === null ? "blank" : isError(v) ? "error" : typeof v);
const sameKind = (a: Scalar, b: Scalar) => kind(a) === kind(b);

/** Index of the first exact match, or -1. Text compares without case; wildcards when allowed. */
export function exactIndex(
  values: Scalar[],
  lookup: Scalar,
  wildcards: boolean,
  fromEnd = false,
): number {
  const re =
    wildcards && typeof lookup === "string" && /[*?~]/u.test(lookup)
      ? wildcardRegExp(lookup)
      : null;
  const order = values.map((_, i) => i);
  if (fromEnd) order.reverse();
  for (const i of order) {
    const v = values[i] ?? null;
    if (re) {
      if (typeof v === "string" && re.test(v)) return i;
    } else if (sameKind(v, lookup) && !isError(v) && compare(v as Plain, lookup as Plain) === 0)
      return i;
  }
  return -1;
}

/** Approximate match on data sorted ascending: the last value not greater than the lookup. */
export function lastNotGreater(values: Scalar[], lookup: Scalar): number {
  let best = -1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? null;
    if (!sameKind(v, lookup) || isError(v)) continue;
    if (compare(v as Plain, lookup as Plain) <= 0) best = i;
    else break;
  }
  return best;
}

/** Approximate match on data sorted descending: the last value not smaller than the lookup. */
function lastNotSmaller(values: Scalar[], lookup: Scalar): number {
  let best = -1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i] ?? null;
    if (!sameKind(v, lookup) || isError(v)) continue;
    if (compare(v as Plain, lookup as Plain) >= 0) best = i;
    else break;
  }
  return best;
}

/** XLOOKUP's next-smaller or next-larger match, which does not need sorted data. */
function nearestIndex(
  values: Scalar[],
  lookup: Scalar,
  direction: -1 | 1,
  fromEnd: boolean,
): number {
  let best = -1;
  const order = values.map((_, i) => i);
  if (fromEnd) order.reverse();
  for (const i of order) {
    const v = values[i] ?? null;
    if (!sameKind(v, lookup) || isError(v)) continue;
    const c = compare(v as Plain, lookup as Plain);
    if (c === 0) return i;
    if (c === -direction) continue;
    const current = best === -1 ? null : (values[best] as Plain);
    if (current === null || compare(v as Plain, current) === -direction) best = i;
  }
  return best;
}

function tableLookup(
  lookup: Scalar,
  table: RangeValue,
  index: number,
  approximate: boolean,
  byRow: boolean,
): Value {
  const lines = byRow
    ? table.rows
    : (table.rows[0] ?? []).map((_, j) => table.rows.map((r) => r[j] ?? null));
  // lines[k] is a row (VLOOKUP) or a column (HLOOKUP); keys are their first cells.
  const keys = lines.map((l) => l[0] ?? null);
  const width = lines[0]?.length ?? 0;
  if (index < 1) return fail("#VALUE!");
  if (index > width) return fail("#REF!");
  const at = approximate ? lastNotGreater(keys, lookup) : exactIndex(keys, lookup, true);
  if (at < 0) return fail("#N/A");
  return lines[at]?.[index - 1] ?? null;
}

const asRange = (rows: Scalar[][], origin: RangeValue["origin"]): Value =>
  rows.length === 1 && rows[0]?.length === 1
    ? (rows[0][0] ?? null)
    : { kind: "range", rows, origin };

export const LOOKUP: Record<string, FunctionSpec> = {
  VLOOKUP: fn(
    3,
    4,
    safe((args) => {
      const lookup = scalar(args[0]);
      return tableLookup(
        lookup,
        range(args[1]),
        Math.trunc(num(args[2])),
        args[3]?.empty ? false : bool(args[3], true),
        true,
      );
    }),
  ),
  HLOOKUP: fn(
    3,
    4,
    safe((args) => {
      const lookup = scalar(args[0]);
      return tableLookup(
        lookup,
        range(args[1]),
        Math.trunc(num(args[2])),
        args[3]?.empty ? false : bool(args[3], true),
        false,
      );
    }),
  ),
  MATCH: fn(
    2,
    3,
    safe((args) => {
      const lookup = scalar(args[0]);
      const values = vector(range(args[1]));
      if (!values) return fail("#N/A");
      const type = Math.sign(num(args[2], 1));
      const at =
        type === 0
          ? exactIndex(values, lookup, true)
          : type > 0
            ? lastNotGreater(values, lookup)
            : lastNotSmaller(values, lookup);
      return at < 0 ? fail("#N/A") : at + 1;
    }),
  ),
  INDEX: fn(
    2,
    3,
    safe((args) => {
      const r = range(args[0]);
      const h = r.rows.length;
      const w = r.rows[0]?.length ?? 0;
      let row = Math.trunc(num(args[1], 0));
      let col = Math.trunc(num(args[2], 0));
      if (!args[2] && h === 1) {
        col = row;
        row = 1;
      }
      if (row < 0 || col < 0 || row > h || col > w) return fail("#REF!");
      if (row === 0 && col === 0) return r;
      if (row === 0)
        return asRange(
          r.rows.map((line) => [line[col - 1] ?? null]),
          { col: r.origin.col + col - 1, row: r.origin.row },
        );
      if (col === 0) {
        if (w === 1) return r.rows[row - 1]?.[0] ?? null;
        return asRange([r.rows[row - 1] ?? []], { col: r.origin.col, row: r.origin.row + row - 1 });
      }
      return r.rows[row - 1]?.[col - 1] ?? null;
    }),
  ),
  XLOOKUP: fn(
    3,
    6,
    safe((args) => {
      const lookup = scalar(args[0]);
      const lookIn = range(args[1]);
      const values = vector(lookIn);
      if (!values) return fail("#VALUE!");
      const ret = range(args[2]);
      const vertical = lookIn.rows.length > 1 || (lookIn.rows[0]?.length ?? 0) === 1;
      const length = vertical ? ret.rows.length : (ret.rows[0]?.length ?? 0);
      if (length !== values.length) return fail("#VALUE!");
      const mode = Math.trunc(num(args[4], 0));
      const search = Math.trunc(num(args[5], 1));
      if (![0, -1, 1, 2].includes(mode) || ![1, -1, 2, -2].includes(search)) return fail("#VALUE!");
      const fromEnd = search < 0;
      const at =
        mode === 0
          ? exactIndex(values, lookup, false, fromEnd)
          : mode === 2
            ? exactIndex(values, lookup, true, fromEnd)
            : nearestIndex(values, lookup, mode as -1 | 1, fromEnd);
      if (at < 0) {
        const notFound = args[3];
        return notFound && !notFound.empty ? notFound.get() : fail("#N/A");
      }
      return vertical
        ? asRange([ret.rows[at] ?? []], { col: ret.origin.col, row: ret.origin.row + at })
        : asRange(
            ret.rows.map((line) => [line[at] ?? null]),
            { col: ret.origin.col + at, row: ret.origin.row },
          );
    }),
  ),
};
