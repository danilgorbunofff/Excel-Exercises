// Why this exists: puts a grader result in the shape Excel results take, so
// the audit and the parity test compare like with like. A spilled block shows
// blanks as 0, as Excel's grid does; a one-cell block is a single value.
import type { Value } from "@practice/grader";
import type { ExcelScalar } from "./excel-bridge.ts";

type Shape = ExcelScalar | ExcelScalar[][];

const scalar = (v: unknown, inBlock: boolean): ExcelScalar => {
  if (v === null || v === undefined) return inBlock ? 0 : 0;
  if (typeof v === "object" && (v as { kind?: string }).kind === "error")
    return { error: (v as { code: string }).code };
  return v as ExcelScalar;
};

export function toExcelShape(v: Value): Shape {
  if (typeof v === "object" && v !== null && (v as { kind?: string }).kind === "range") {
    const rows = (v as { rows: unknown[][] }).rows;
    if (rows.length === 1 && rows[0]?.length === 1) return scalar(rows[0][0], false);
    return rows.map((r) => r.map((c) => scalar(c, true)));
  }
  return scalar(v, false);
}

const close = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

function sameScalar(a: ExcelScalar, b: ExcelScalar): boolean {
  // Excel reads an empty cell referenced alone as 0 in the grid.
  const na = a === null ? 0 : a;
  const nb = b === null ? 0 : b;
  if (typeof na === "number" && typeof nb === "number") return close(na, nb);
  if (typeof na === "object" && typeof nb === "object" && na && nb) return na.error === nb.error;
  return na === nb;
}

export function sameExcel(a: Shape, b: Shape): boolean {
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (!Array.isArray(a) || !Array.isArray(b)) return sameScalar(a as ExcelScalar, b as ExcelScalar);
  return (
    a.length === b.length &&
    a.every(
      (r, i) => r.length === b[i]?.length && r.every((c, j) => sameScalar(c, b[i]?.[j] ?? null)),
    )
  );
}
