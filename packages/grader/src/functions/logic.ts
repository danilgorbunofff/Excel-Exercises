// Why this exists: IF, AND, OR and the error-catching functions. IF only
// evaluates the branch it chooses, so IF(TRUE,1,1/0) is 1, as in Excel.
import { errorValue, isError } from "../errors.ts";
import {
  type Arg,
  compare,
  type FunctionSpec,
  isRange,
  type Scalar,
  toBool,
  toScalar,
  type Value,
} from "../values.ts";
import { bool, cells, ExcelError, fail, fn, safe } from "./helpers.ts";

/** The value of a chosen branch. A missing one gives `missing`; an empty one such as IF(A1,,1) gives 0. */
function branch(arg: Arg | undefined, missing: Scalar): Value {
  if (!arg) return missing;
  if (arg.empty) return 0;
  return arg.get();
}

/** Logical values for AND and OR. Text and blanks in ranges are skipped. */
function logicals(args: Arg[]): boolean[] {
  const out: boolean[] = [];
  for (const a of args) {
    if (a.empty) continue;
    const v = a.get();
    if (isRange(v)) {
      for (const c of cells(v)) {
        if (isError(c)) throw new ExcelError(c);
        if (typeof c === "boolean") out.push(c);
        else if (typeof c === "number") out.push(c !== 0);
      }
      continue;
    }
    const b = toBool(v);
    if (isError(b)) throw new ExcelError(b);
    out.push(b);
  }
  if (!out.length) fail("#VALUE!");
  return out;
}

function catchError(test: (code: string) => boolean): FunctionSpec["run"] {
  return (args) => {
    const v = args[0]?.get() ?? null;
    const s = toScalar(v);
    return isError(s) && test(s.code) ? branch(args[1], 0) : v;
  };
}

export const LOGIC: Record<string, FunctionSpec> = {
  IF: fn(
    2,
    3,
    safe((args) => (bool(args[0], false) ? branch(args[1], false) : branch(args[2], false))),
  ),
  AND: fn(
    1,
    255,
    safe((args) => logicals(args).every(Boolean)),
  ),
  OR: fn(
    1,
    255,
    safe((args) => logicals(args).some(Boolean)),
  ),
  NOT: fn(
    1,
    1,
    safe((args) => !bool(args[0], false)),
  ),
  IFERROR: fn(
    2,
    2,
    catchError(() => true),
  ),
  IFNA: fn(
    2,
    2,
    catchError((code) => code === "#N/A"),
  ),
  IFS: fn(
    2,
    254,
    safe((args) => {
      if (args.length % 2) return fail("#N/A");
      for (let i = 0; i < args.length; i += 2) {
        if (bool(args[i], false)) return branch(args[i + 1], 0);
      }
      return fail("#N/A");
    }),
  ),
  // SWITCH compares the first value with each case in turn and only works
  // out the result it returns. A last odd argument is the default.
  SWITCH: fn(3, 254, (args) => {
    const subject = toScalar(branch(args[0], null));
    if (isError(subject)) return subject;
    const pairs = args.slice(1);
    for (let i = 0; i + 1 < pairs.length; i += 2) {
      const value = toScalar(branch(pairs[i], null));
      if (isError(value)) return value;
      const same = typeof value === typeof subject || value === null || subject === null;
      if (same && compare(value, subject) === 0) return branch(pairs[i + 1], 0);
    }
    return pairs.length % 2 ? branch(pairs[pairs.length - 1], 0) : errorValue("#N/A");
  }),
  TRUE: fn(0, 0, () => true),
  FALSE: fn(0, 0, () => false),
};
