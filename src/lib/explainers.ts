// Why this exists: what each function does and its syntax line, read from the
// function index, for the formula widget on function pages.
import { loadFunctionIndex } from "./functions.ts";

/** What each function does, in one line. */
export function functionSummaries(): Record<string, string> {
  return Object.fromEntries(loadFunctionIndex().functions.map((f) => [f.name, f.summary]));
}

/** Each function's syntax line, used to label its arguments. */
export function functionSyntaxes(): Record<string, string> {
  return Object.fromEntries(loadFunctionIndex().functions.map((f) => [f.name, f.syntax]));
}
