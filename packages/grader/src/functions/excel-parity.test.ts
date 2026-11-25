// Replays every case of the grader audit against the answer Microsoft Excel
// gave for it (tools/audit/grader-excel.json, written by tools/audit-grader.ts
// from Excel 16.109 on macOS). The grader must give the same value or error.
// Cases whose Excel answer depends on the region's separators are skipped:
// that Excel ran in en_CZ, so they still need an en-US check.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CELL, SHEET } from "../../../../tools/audit/grader-cases.ts";
import { sameExcel, toExcelShape } from "../../../../tools/lib/excel-compare.ts";
import { parseAddress } from "../address.ts";
import { evaluateFormula } from "../evaluate.ts";
import { createGrid } from "../grid.ts";

interface Row {
  area: string;
  formula: string;
  locale?: boolean;
  excel: Parameters<typeof sameExcel>[1];
}
const rows = JSON.parse(
  readFileSync(new URL("../../../../tools/audit/grader-excel.json", import.meta.url), "utf8"),
) as Row[];

/** Differences that are understood, each with the reason it is kept. */
const KNOWN: Record<string, string> = {
  "=F2:F4*F2:F3":
    "Excel pads to 3 rows with #N/A (ROWS gives 3); the automation read back only 2 rows.",
  "=LET(x,2,x,3,x)": "Excel refuses the formula; grade() reports it as syntax before evaluating.",
  "=LET(x,2)": "Excel refuses the formula; grade() reports it as syntax before evaluating.",
  "=LET(x.y,2,x.y+1)": "Excel refuses the formula; grade() reports it as syntax before evaluating.",
  "=@F2:F4":
    "Excel gives #VALUE! (no intersection); the grader returns the block. Both fail a one-cell answer.",
  "=F2:F4 F3:F5": "The space intersection operator is not supported; the grader says syntax.",
  "=SUM(F2:F4 F3:F5)": "The space intersection operator is not supported; the grader says syntax.",
};

const grid = createGrid(SHEET);
const at = parseAddress(CELL);

describe("the grader gives Excel's answer", () => {
  it("has the recorded cases", () => {
    expect(rows.length).toBeGreaterThan(500);
  });
  for (const r of rows) {
    if (r.locale || KNOWN[r.formula]) continue;
    it(`[${r.area}] ${r.formula}`, () => {
      const ours = toExcelShape(evaluateFormula(r.formula, grid, at ?? undefined));
      expect(sameExcel(ours, r.excel), JSON.stringify({ ours, excel: r.excel })).toBe(true);
    });
  }
});
