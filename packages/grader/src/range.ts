// Why this exists: turns a range such as B2:B5 into the cells it covers.
// Whole columns and rows are limited to the sheet's used area, so B:B means
// the cells that exist in column B, not a million empty ones.
import type { Address } from "./address.ts";
import type { Bound } from "./parse.ts";

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SheetSize {
  rows: number;
  cols: number;
}

export function rangeBox(first: Bound, last: Bound, size: SheetSize): Box {
  const c1 = first.col ?? 1;
  const c2 = last.col ?? size.cols;
  const r1 = first.row ?? 1;
  const r2 = last.row ?? size.rows;
  return {
    top: Math.min(r1, r2),
    bottom: Math.max(r1, r2),
    left: Math.min(c1, c2),
    right: Math.max(c1, c2),
  };
}

export function expandRange(first: Bound, last: Bound, size: SheetSize): Address[][] {
  const box = rangeBox(first, last, size);
  const rows: Address[][] = [];
  for (let row = box.top; row <= box.bottom; row++) {
    const line: Address[] = [];
    for (let col = box.left; col <= box.right; col++) line.push({ col, row });
    rows.push(line);
  }
  return rows;
}
