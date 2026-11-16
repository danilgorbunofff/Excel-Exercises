// Why this exists: the IS functions, which answer TRUE or FALSE about a value's
// type. ISNA and ISERROR read an error as a value, so an error in their
// argument is their answer, not a failure.
import { errorValue, isError } from "../errors.ts";
import {
  type Arg,
  array,
  type FunctionSpec,
  isRange,
  type Scalar,
  toScalar,
  type Value,
} from "../values.ts";

/** ROW or COLUMN of a reference: one number, or a list for a range several rows or columns deep. */
function position(arg: Arg | undefined, own: number | undefined, axis: "row" | "col"): Value {
  if (!arg || arg.empty) return own ?? errorValue("#VALUE!");
  const v = arg.get();
  if (!isRange(v) || v.origin[axis] === 0) return errorValue("#VALUE!");
  const n = axis === "row" ? v.rows.length : (v.rows[0]?.length ?? 0);
  const at = v.origin[axis];
  if (n === 1) return at;
  return axis === "row"
    ? array(Array.from({ length: n }, (_, i) => [at + i]))
    : array([Array.from({ length: n }, (_, i) => at + i)]);
}

import { fn } from "./helpers.ts";

const test = (check: (v: Scalar) => boolean): FunctionSpec =>
  fn(1, 1, (args: Arg[]) => check(args[0] && !args[0].empty ? toScalar(args[0].get()) : null));

export const INFO: Record<string, FunctionSpec> = {
  // N: a number stays, TRUE is 1, anything else (text, FALSE, blank) is 0.
  // Given a range on the sheet, N reads only its first cell (SUM(N(F2:F4)) is F2);
  // given a computed array, it converts each cell (SUMPRODUCT(N(F2:F9>2))). Both as in Excel.
  N: fn(1, 1, (args) => {
    const raw = args[0]?.get() ?? null;
    const one = (v: Scalar): Scalar =>
      isError(v) ? v : typeof v === "number" ? v : v === true ? 1 : 0;
    if (!isRange(raw)) return one(raw);
    if (raw.origin.row > 0) return one(raw.rows[0]?.[0] ?? null);
    return array(raw.rows.map((r) => r.map(one)));
  }),
  // ROW and COLUMN: the position of a reference, or of the formula's own cell.
  ROW: fn(0, 1, (args, options) => position(args[0], options?.cell?.row, "row")),
  COLUMN: fn(0, 1, (args, options) => position(args[0], options?.cell?.col, "col")),
  ISNUMBER: test((v) => typeof v === "number"),
  ISTEXT: test((v) => typeof v === "string"),
  ISBLANK: test((v) => v === null),
  ISNA: test((v) => isError(v) && v.code === "#N/A"),
  ISERROR: test((v) => isError(v)),
};
