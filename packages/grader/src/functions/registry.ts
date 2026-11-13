// Why this exists: the one list of functions the grader knows. The parser
// uses it to tell a function from an unknown name, and the evaluator looks
// up implementations here.
import { FUNCTIONS } from "./index.ts";

export function isKnownFunction(name: string): boolean {
  return Object.hasOwn(FUNCTIONS, name.toUpperCase());
}

export function knownFunctions(): string[] {
  return Object.keys(FUNCTIONS).sort();
}
