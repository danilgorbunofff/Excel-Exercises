// Why this exists: collects every function implementation by its Excel name.
// The parser and evaluator read it through registry.ts.
import type { FunctionSpec } from "../values.ts";
import { ARRAYS } from "./arrays.ts";
import { CRITERIA } from "./criteria.ts";
import { DATES } from "./date.ts";
import { INFO } from "./info.ts";
import { LOGIC } from "./logic.ts";
import { LOOKUP } from "./lookup.ts";
import { MATH } from "./math.ts";
import { STATS } from "./stats.ts";
import { TEXT } from "./text.ts";

export const FUNCTIONS: Record<string, FunctionSpec> = {
  ...MATH,
  ...LOGIC,
  ...CRITERIA,
  ...LOOKUP,
  ...TEXT,
  ...DATES,
  ...INFO,
  ...STATS,
  ...ARRAYS,
};
