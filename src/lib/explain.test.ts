import { describe, expect, it } from "vitest";
import { argLabels, describeValue, explain } from "./explain.ts";

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
  it("flags a formula that works out to an error value", () => {
    const r = explain('=VLOOKUP("West",A2:B4,2,FALSE)', rows);
    expect(r.ok && r.error).toBe(true);
    expect(r.ok && r.result).toBe("#N/A");
    const fine = explain("=SUM(B2:B4)", rows);
    expect(fine.ok && fine.error).toBe(false);
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

  it("labels each argument and counts what each condition matches", () => {
    const sheet = [
      ["Region", "Product", "Sales"],
      ["North", "Tea", 120],
      ["South", "Tea", 95],
      ["North", "Coffee", 143],
      ["North", "Tea", 88],
      ["South", "Coffee", 60],
      ["North", "Tea", 41],
    ];
    const r = explain(
      '=SUMIFS(C2:C7,A2:A7,"North",B2:B7,"Tea")',
      sheet,
      { SUMIFS: "Adds the cells that meet several conditions." },
      { SUMIFS: "=SUMIFS(sum_range, criteria_range1, criteria1, ...)" },
    );
    expect(r.ok && r.result).toBe("249");
    if (!r.ok) return;
    expect(r.steps.note).toBe(
      "Adds the cells that meet several conditions. 3 of 6 rows meet every condition: 120 + 88 + 41.",
    );
    const kids = r.steps.children;
    expect(kids.map((k) => k.arg)).toEqual([
      "sum range",
      "criteria range 1",
      "criteria 1",
      "criteria range 2",
      "criteria 2",
    ]);
    expect(kids[0]?.note).toBe("");
    expect(kids[2]).toMatchObject({ text: '"North"', note: "4 of 6 cells in A2:A7 match." });
    expect(kids[4]?.note).toBe("4 of 6 cells in B2:B7 match.");
  });
  it("repeats numbered argument groups past the syntax line", () => {
    expect(argLabels("=SUM(number1, [number2], ...)", 3)).toEqual([
      "number 1",
      "number 2",
      "number 3",
    ]);
    expect(
      argLabels("=COUNTIFS(criteria_range1, criteria1, [criteria_range2, criteria2], ...)", 6),
    ).toEqual([
      "criteria range 1",
      "criteria 1",
      "criteria range 2",
      "criteria 2",
      "criteria range 3",
      "criteria 3",
    ]);
    expect(
      argLabels("=VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])", 3),
    ).toEqual(["lookup value", "table array", "col index num"]);
    expect(
      argLabels("=SWITCH(expression, value1, result1, [value2, result2], ..., [default])", 7)[6],
    ).toBe(undefined);
  });
  it("names the values an operator works on, and the branch IF takes", () => {
    const r = explain("=SUM(B2:B4)/3", rows);
    expect(r.ok && r.steps.note).toBe("Divides 358 by 3.");
    const yes = explain('=IF(B2>100,"Big","Small")', rows, { IF: "Picks one of two values." });
    expect(yes.ok && yes.steps.note).toBe(
      "Picks one of two values. The test is TRUE, so it returns the second argument.",
    );
    const no = explain("=IF(B3>100,1)", rows, { IF: "Picks one of two values." });
    expect(no.ok && no.steps.note).toContain("there is no third argument, so it returns FALSE.");
  });

  it("colours each distinct reference and splits the formula around them", () => {
    const r = explain("=SUM($B$2:B4)+B2*B2", rows);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.refs).toEqual([
      { text: "B2:B4", box: { top: 2, bottom: 4, left: 2, right: 2 } },
      { text: "B2", box: { top: 2, bottom: 2, left: 2, right: 2 } },
    ]);
    expect(r.formula).toEqual([
      { text: "=SUM(" },
      { text: "$B$2:B4", ref: 0 },
      { text: ")+" },
      { text: "B2", ref: 1 },
      { text: "*" },
      { text: "B2", ref: 1 },
    ]);
    expect(r.steps.reads).toEqual([0, 1]);
    expect(r.steps.children[0]?.reads).toEqual([0]);
    expect(r.steps.children[0]?.children[0]?.ref).toBe(0);
  });
});
