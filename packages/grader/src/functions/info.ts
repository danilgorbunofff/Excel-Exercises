// Why this exists: the IS functions, which answer TRUE or FALSE about a value's
// type. ISNA and ISERROR read an error as a value, so an error in their
// argument is their answer, not a failure.
import { isError } from "../errors.ts";
import { type Arg, type FunctionSpec, type Scalar, toScalar } from "../values.ts";
import { fn } from "./helpers.ts";

const test = (check: (v: Scalar) => boolean): FunctionSpec =>
  fn(1, 1, (args: Arg[]) => check(args[0] && !args[0].empty ? toScalar(args[0].get()) : null));

export const INFO: Record<string, FunctionSpec> = {
  ISNUMBER: test((v) => typeof v === "number"),
  ISTEXT: test((v) => typeof v === "string"),
  ISBLANK: test((v) => v === null),
  ISNA: test((v) => isError(v) && v.code === "#N/A"),
  ISERROR: test((v) => isError(v)),
};
