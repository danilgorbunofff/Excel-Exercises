// Why this exists: Excel's dynamic-array functions. Each returns a block of
// cells that spills from the formula's cell. LET is listed here so the parser
// knows it, but evaluate.ts runs it, because it binds names.
import { errorValue, isError } from "../errors.ts";
import {
  array,
  compare,
  type FunctionSpec,
  rowsOf,
  type Scalar,
  toBool,
  toNumber,
  type Value,
} from "../values.ts";
import { ExcelError, fail, fn, num, safe } from "./helpers.ts";

type Plain = Exclude<Scalar, { kind: "error" }>;

/** An argument as rows of cells. A missing one fails with #VALUE!. */
const grid = (v: Value | undefined): Scalar[][] => {
  if (v === undefined) return fail("#VALUE!");
  if (isError(v)) throw new ExcelError(v);
  return rowsOf(v);
};

/** Rows to columns. */
const flip = (rows: Scalar[][]): Scalar[][] =>
  (rows[0] ?? []).map((_, j) => rows.map((r) => r[j] ?? null));

/** A one-row or one-column block as a list, or null. */
const line = (rows: Scalar[][]): Scalar[] | null =>
  rows.length === 1
    ? (rows[0] ?? [])
    : rows.every((r) => r.length === 1)
      ? rows.map((r) => r[0] ?? null)
      : null;

/** Excel's sort order: numbers, then text, then logicals; errors after. Blanks go last either way. */
function sortCompare(a: Scalar, b: Scalar, order: number): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  if (isError(a) || isError(b)) return isError(a) === isError(b) ? 0 : isError(a) ? 1 : -1;
  return order * compare(a as Plain, b as Plain);
}

/** A key that treats text without case and keeps 1 apart from "1". */
const key = (row: Scalar[]) =>
  row
    .map((c) =>
      c === null
        ? "b:"
        : isError(c)
          ? `e:${c.code}`
          : typeof c === "string"
            ? `s:${c.toLowerCase()}`
            : `${typeof c}:${String(c)}`,
    )
    .join("\u0000");

/** Rows chosen by 1-based positions; negative counts from the end. */
function choose(rows: Scalar[][], positions: number[]): Scalar[][] {
  return positions.map((p) => {
    const i = Math.trunc(p);
    const at = i < 0 ? rows.length + i : i - 1;
    if (i === 0 || at < 0 || at >= rows.length) return fail("#VALUE!");
    return rows[at] as Scalar[];
  });
}

/** A row of a stacked block, filled out to width w with #N/A. */
const padTo = (row: Scalar[], w: number): Scalar[] =>
  Array.from({ length: w }, (_, j) => (j < row.length ? (row[j] ?? null) : errorValue("#N/A")));

/** A cell as a number, or a thrown #VALUE! / error. */
const numberOf = (c: Scalar): number => {
  const n = toNumber(c);
  if (isError(n)) throw new ExcelError(n);
  return n;
};

const result = (rows: Scalar[][]): Value =>
  rows.length === 0 || (rows[0]?.length ?? 0) === 0 ? errorValue("#CALC!") : array(rows);

export const ARRAYS: Record<string, FunctionSpec> = {
  TRANSPOSE: fn(
    1,
    1,
    safe((args) => result(flip(grid(args[0]?.get())))),
  ),
  DROP: fn(
    2,
    3,
    safe((args) => {
      const cut = (list: Scalar[][], n: number) =>
        n >= 0 ? list.slice(n) : list.slice(0, Math.max(0, list.length + n));
      let out = grid(args[0]?.get());
      if (args[1] && !args[1].empty) out = cut(out, Math.trunc(num(args[1])));
      if (args[2] && !args[2].empty) out = flip(cut(flip(out), Math.trunc(num(args[2]))));
      return result(out);
    }),
  ),
  CHOOSEROWS: fn(
    2,
    254,
    safe((args) =>
      result(
        choose(
          grid(args[0]?.get()),
          args.slice(1).map((a) => num(a)),
        ),
      ),
    ),
  ),
  // VSTACK and HSTACK pad a shorter block with #N/A, as Excel does.
  VSTACK: fn(
    1,
    254,
    safe((args) => {
      const blocks = args.map((a) => grid(a.get()));
      const w = Math.max(...blocks.map((b) => b[0]?.length ?? 0));
      return result(blocks.flatMap((b) => b.map((r) => padTo(r, w))));
    }),
  ),
  HSTACK: fn(
    1,
    254,
    safe((args) => {
      const blocks = args.map((a) => flip(grid(a.get())));
      const h = Math.max(...blocks.map((b) => b[0]?.length ?? 0));
      return result(flip(blocks.flatMap((b) => b.map((c) => padTo(c, h)))));
    }),
  ),
  TOCOL: fn(
    1,
    3,
    safe((args) => {
      const data = grid(args[0]?.get());
      const ignore = Math.trunc(num(args[1], 0));
      const byColumn = args[2] && !args[2].empty ? toBool(args[2].get() as Scalar) === true : false;
      const kept = (byColumn ? flip(data) : data)
        .flat()
        .filter((c) => !((ignore === 1 || ignore === 3) && c === null))
        .filter((c) => !((ignore === 2 || ignore === 3) && isError(c)));
      return result(kept.map((c) => [c]));
    }),
  ),
  FILTER: fn(
    2,
    3,
    safe((args) => {
      const data = grid(args[0]?.get());
      const include = line(grid(args[1]?.get()));
      if (!include) return fail("#VALUE!");
      const keep = (c: Scalar) => {
        const b = toBool(c);
        if (isError(b)) throw new ExcelError(b);
        return b;
      };
      let out: Scalar[][];
      if (include.length === data.length && (data.length > 1 || data[0]?.length === 1)) {
        out = data.filter((_, i) => keep(include[i] ?? null));
      } else if (include.length === (data[0]?.length ?? 0)) {
        out = flip(flip(data).filter((_, j) => keep(include[j] ?? null)));
      } else return fail("#VALUE!");
      if (out.length > 0 && (out[0]?.length ?? 0) > 0) return array(out);
      const empty = args[2];
      return empty && !empty.empty ? empty.get() : errorValue("#CALC!");
    }),
  ),
  UNIQUE: fn(
    1,
    3,
    safe((args) => {
      const byCol = args[1] && !args[1].empty ? toBool(grid(args[1].get())[0]?.[0] ?? null) : false;
      const once = args[2] && !args[2].empty ? toBool(grid(args[2].get())[0]?.[0] ?? null) : false;
      if (isError(byCol)) return byCol;
      if (isError(once)) return once;
      const data = grid(args[0]?.get());
      const rows = byCol ? flip(data) : data;
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);
      const seen = new Set<string>();
      const out = rows.filter((r) => {
        const k = key(r);
        if (seen.has(k) || (once && counts.get(k) !== 1)) return false;
        seen.add(k);
        return true;
      });
      return result(byCol ? flip(out) : out);
    }),
  ),
  SORT: fn(
    1,
    4,
    safe((args) => {
      // sort_index and sort_order may be lists, as in SORT(A2:F9,{2,6},{1,-1}): several keys.
      const list = (i: number) =>
        args[i] && !args[i].empty
          ? grid(args[i].get())
              .flat()
              .map((c) => numberOf(c))
          : [1];
      const indexes = list(1).map(Math.trunc);
      const orders = list(2);
      const byCol = args[3] && !args[3].empty ? toBool(grid(args[3].get())[0]?.[0] ?? null) : false;
      if (isError(byCol)) return byCol;
      if (orders.some((o) => o !== 1 && o !== -1)) return fail("#VALUE!");
      if (orders.length > 1 && orders.length !== indexes.length) return fail("#VALUE!");
      const data = grid(args[0]?.get());
      const rows = byCol ? flip(data) : data;
      if (indexes.some((k) => k < 1 || k > (rows[0]?.length ?? 0))) return fail("#VALUE!");
      const sorted = rows
        .map((r, i) => ({ r, i }))
        .sort((a, b) => {
          for (const [n, k] of indexes.entries()) {
            const c = sortCompare(
              a.r[k - 1] ?? null,
              b.r[k - 1] ?? null,
              orders[n] ?? orders[0] ?? 1,
            );
            if (c) return c;
          }
          return a.i - b.i;
        })
        .map((x) => x.r);
      return result(byCol ? flip(sorted) : sorted);
    }),
  ),
  SORTBY: fn(
    2,
    253,
    safe((args) => {
      const data = grid(args[0]?.get());
      const keys: { values: Scalar[]; order: number }[] = [];
      for (let i = 1; i < args.length; i += 2) {
        const values = line(grid(args[i]?.get()));
        if (!values || values.length !== data.length) return fail("#VALUE!");
        const order = num(args[i + 1], 1);
        if (order !== 1 && order !== -1) return fail("#VALUE!");
        keys.push({ values, order });
      }
      const sorted = data
        .map((r, i) => ({ r, i }))
        .sort((a, b) => {
          for (const { values, order } of keys) {
            const c = sortCompare(values[a.i] ?? null, values[b.i] ?? null, order);
            if (c !== 0) return c;
          }
          return a.i - b.i;
        })
        .map((x) => x.r);
      return result(sorted);
    }),
  ),
  SEQUENCE: fn(
    1,
    4,
    safe((args) => {
      const rows = Math.trunc(num(args[0]));
      const cols = Math.trunc(num(args[1], 1));
      const start = num(args[2], 1);
      const step = num(args[3], 1);
      if (rows < 1 || cols < 1) return errorValue("#CALC!");
      if (rows * cols > 100000) return fail("#NUM!");
      return array(
        Array.from({ length: rows }, (_, i) =>
          Array.from({ length: cols }, (_, j) => start + (i * cols + j) * step),
        ),
      );
    }),
  ),
  TAKE: fn(
    2,
    3,
    safe((args) => {
      const data = grid(args[0]?.get());
      const cut = (list: Scalar[][], n: number) =>
        n >= 0 ? list.slice(0, n) : list.slice(Math.max(0, list.length + n));
      let out = data;
      if (args[1] && !args[1].empty) out = cut(out, Math.trunc(num(args[1])));
      if (args[2] && !args[2].empty) out = flip(cut(flip(out), Math.trunc(num(args[2]))));
      return result(out);
    }),
  ),
  CHOOSECOLS: fn(
    2,
    254,
    safe((args) => {
      const data = grid(args[0]?.get());
      // A position may be a list, as in CHOOSECOLS(A2:F3,{1,3}).
      const positions = args.slice(1).flatMap((a) =>
        grid(a.get())
          .flat()
          .map((c) => numberOf(c)),
      );
      return result(flip(choose(flip(data), positions)));
    }),
  ),
  ROWS: fn(
    1,
    1,
    safe((args) => grid(args[0]?.get()).length),
  ),
  COLUMNS: fn(
    1,
    1,
    safe((args) => grid(args[0]?.get())[0]?.length ?? 0),
  ),
  // Run by evaluate.ts; listed so the parser and checks know the name and argument count.
  LET: fn(3, 253, () => errorValue("#VALUE!")),
};
