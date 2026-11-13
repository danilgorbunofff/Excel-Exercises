import { describe, expect, it } from "vitest";
import { expandRange, rangeBox } from "./range.ts";

const bound = (col: number | null, row: number | null) => ({
  col,
  row,
  absCol: false,
  absRow: false,
});

describe("expandRange", () => {
  it("lists addresses row by row", () => {
    expect(expandRange(bound(1, 1), bound(2, 2), { rows: 9, cols: 9 })).toEqual([
      [
        { col: 1, row: 1 },
        { col: 2, row: 1 },
      ],
      [
        { col: 1, row: 2 },
        { col: 2, row: 2 },
      ],
    ]);
  });

  it("puts a range written backwards in order, as Excel does", () => {
    expect(rangeBox(bound(2, 5), bound(2, 2), { rows: 9, cols: 9 })).toEqual({
      top: 2,
      bottom: 5,
      left: 2,
      right: 2,
    });
  });

  it("limits whole columns and rows to the used sheet", () => {
    expect(rangeBox(bound(2, null), bound(2, null), { rows: 7, cols: 3 })).toEqual({
      top: 1,
      bottom: 7,
      left: 2,
      right: 2,
    });
    expect(rangeBox(bound(null, 3), bound(null, 4), { rows: 7, cols: 3 })).toEqual({
      top: 3,
      bottom: 4,
      left: 1,
      right: 3,
    });
  });
});
