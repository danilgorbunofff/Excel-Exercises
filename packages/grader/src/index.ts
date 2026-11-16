// Why this exists: the public entry of the formula grader. It is a pure
// package with no DOM, so the same code grades in the browser and in tests.
// The pipeline is tokenize, parse, evaluate, grade; walkAst and expandRange
// let the interface draw what a formula reads.

/** Version of the grading rules. Bump it only for an intended grader change. */
export const GRADER_VERSION = "1.2.0";

export {
  type Address,
  type CellAddress,
  columnIndex,
  columnLetters,
  formatAddress,
  parseAddress,
} from "./address.ts";
export { ERROR_CODES, type ErrorCode, type ErrorValue, errorValue, isError } from "./errors.ts";
export { evaluate, evaluateFormula } from "./evaluate.ts";
export { knownFunctions } from "./functions/registry.ts";
export {
  type Expected,
  formatValue,
  type GradeSpec,
  grade,
  type Read,
  RULES,
  type Rule,
  type Variant,
  type Verdict,
} from "./grade.ts";
export { type CellInput, createGrid, type Grid } from "./grid.ts";
export { type Bound, type Node, parse } from "./parse.ts";
export { type Box, expandRange, rangeBox } from "./range.ts";
export { type Token, tokenize } from "./tokenize.ts";
export type { Scalar, Value } from "./values.ts";
export { walkAst } from "./walk.ts";
