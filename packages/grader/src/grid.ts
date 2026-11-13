// Why this exists: the exercise sheet as the evaluator sees it. Rows start at
// A1; null is an empty cell. Cells outside the data are empty too.
import type { Address } from "./address.ts";
import type { SheetSize } from "./range.ts";
import type { Scalar } from "./values.ts";

export type CellInput = number | string | boolean | null;

export interface Grid {
  get(address: Address): Scalar;
  size: SheetSize;
}

export function createGrid(rows: readonly (readonly CellInput[])[]): Grid {
  const size = { rows: rows.length, cols: Math.max(0, ...rows.map((r) => r.length)) };
  return {
    size,
    get: ({ col, row }) => rows[row - 1]?.[col - 1] ?? null,
  };
}
