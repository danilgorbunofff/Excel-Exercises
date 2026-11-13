import { describe, expect, it } from "vitest";
import { describeValue, explain } from "./explain.ts";

const rows = [
  ["Region", "Sales"],
  ["North", 120],
  ["South", 95],
  ["North", 143],
];

describe("explain", () => {
  it("evaluates every part of a nested formula", () => {
    const r = explain("=ROUND(SUM(B2:B4)/3,1)", rows, { ROUND: "Rounds a number." });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result).toBe("119.3");
    expect(r.steps.note).toBe("Rounds a number.");
    const division = r.steps.children[0];
    expect(division?.text).toBe("SUM(B2:B4)/3");
    expect(division?.children[0]?.result).toBe("358");
    expect(division?.children[0]?.children[0]?.result).toBe("{120; 95; 143}");
  });
  it("adds the equals sign when it is missing", () => {
    const r = explain('SUMIF(A2:A4,"North",B2:B4)', rows);
    expect(r.ok && r.result).toBe("263");
  });
  it("reports a syntax error with its position", () => {
    const r = explain("=SUM(B2:B4", rows);
    expect(r.ok).toBe(false);
  });
  it("describes large ranges by size", () => {
    const big = {
      kind: "range",
      origin: { col: 1, row: 1 },
      rows: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    };
    expect(describeValue(big as never)).toBe("3 rows x 3 columns");
    expect(describeValue("North")).toBe('"North"');
    expect(describeValue(null)).toBe("(empty)");
  });
});
