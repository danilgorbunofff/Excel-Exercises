import { describe, expect, it } from "vitest";
import { errorValue } from "./errors.ts";
import { evaluateFormula } from "./evaluate.ts";
import { type GradeSpec, grade } from "./grade.ts";
import { createGrid } from "./grid.ts";
import { isRange, type Value } from "./values.ts";

// A1:C6, with E1:F6 left empty for results.
const rows = [
  ["Region", "Rep", "Sales", null, null, null],
  ["North", "Ana", 300, null, null, null],
  ["South", "Bo", 120, null, null, null],
  ["north", "Cy", 450, null, null, null],
  ["East", "Di", null, null, null, null],
  ["South", "Ed", 120, null, null, null],
];
const grid = createGrid(rows);
const ev = (f: string): Value => evaluateFormula(f, grid);
const cellsOf = (v: Value) => (isRange(v) ? v.rows : [[v]]);

describe("arrays: operators and IF", () => {
  it.each([
    ["=SUM(C2:C6*2)", 1980],
    ['=SUMPRODUCT((A2:A6="North")*C2:C6)', 750],
    ["=SUMPRODUCT(--(C2:C6>200))", 2],
    ['=SUM(IF(A2:A6="South",C2:C6))', 240],
    ["=SUM(IF(C2:C6>200,1,0))", 2],
    ['=MAX(IF(A2:A6="South",C2:C6))', 120],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it("stretches a single row or column and gives #N/A past a shorter side", () => {
    expect(cellsOf(ev("=C2:C3*{1}".replace("*{1}", "*10")))).toEqual([[3000], [1200]]);
    expect(cellsOf(ev("=C2:C4+C2:C3"))).toEqual([[600], [240], [errorValue("#N/A")]]);
  });
});

describe("arrays: dynamic-array functions", () => {
  it("FILTER keeps the rows whose test is true", () => {
    expect(cellsOf(ev("=FILTER(B2:B6,C2:C6>=300)"))).toEqual([["Ana"], ["Cy"]]);
    expect(cellsOf(ev('=FILTER(A2:C6,(A2:A6="South")*(C2:C6>100))'))).toEqual([
      ["South", "Bo", 120],
      ["South", "Ed", 120],
    ]);
  });

  it("FILTER with no match gives #CALC! or the fallback", () => {
    expect(ev("=FILTER(B2:B6,C2:C6>1000)")).toBe(errorValue("#CALC!"));
    expect(ev('=FILTER(B2:B6,C2:C6>1000,"none")')).toBe("none");
  });

  it("UNIQUE ignores case and can keep values that appear once", () => {
    expect(cellsOf(ev("=UNIQUE(A2:A6)"))).toEqual([["North"], ["South"], ["East"]]);
    expect(cellsOf(ev("=UNIQUE(C2:C6,FALSE,TRUE)"))).toEqual([[300], [450], [null]]);
  });

  it("SORT and SORTBY order rows, blanks last", () => {
    expect(cellsOf(ev("=SORT(C2:C6)"))).toEqual([[120], [120], [300], [450], [null]]);
    expect(cellsOf(ev("=SORT(B2:C6,2,-1)")).map((r) => r[0])).toEqual([
      "Cy",
      "Ana",
      "Bo",
      "Ed",
      "Di",
    ]);
    expect(cellsOf(ev("=SORTBY(B2:B6,A2:A6,1,C2:C6,-1)")).flat()).toEqual([
      "Di",
      "Cy",
      "Ana",
      "Bo",
      "Ed",
    ]);
  });

  it("SEQUENCE, TAKE and CHOOSECOLS", () => {
    expect(cellsOf(ev("=SEQUENCE(2,3,10,5)"))).toEqual([
      [10, 15, 20],
      [25, 30, 35],
    ]);
    expect(cellsOf(ev("=TAKE(SORT(B2:C6,2,-1),2)"))).toEqual([
      ["Cy", 450],
      ["Ana", 300],
    ]);
    expect(cellsOf(ev("=TAKE(B2:B6,-1)"))).toEqual([["Ed"]]);
    expect(cellsOf(ev("=CHOOSECOLS(A2:C3,3,1)"))).toEqual([
      [300, "North"],
      [120, "South"],
    ]);
  });

  it("ROWS and COLUMNS measure a range or a spilled result", () => {
    expect(ev("=ROWS(A2:C6)")).toBe(5);
    expect(ev("=COLUMNS(A2:C6)")).toBe(3);
    expect(ev("=ROWS(UNIQUE(A2:A6))")).toBe(3);
  });

  it("LET names a step, and later names can use earlier ones", () => {
    expect(ev("=LET(total,SUM(C2:C6),n,COUNT(C2:C6),total/n)")).toBe(247.5);
    expect(ev("=LET(x,2,y,x*3,x+y)")).toBe(8);
    expect(ev("=LET(x,2)")).toBe(errorValue("#VALUE!"));
  });
});

const spill: GradeSpec = {
  rows,
  answerCell: "E2",
  expected: [["Ana"], ["Cy"]],
  requiredFunctions: ["FILTER"],
  forbiddenFunctions: [],
  requireReference: true,
};

describe("grade: spilled results", () => {
  it("accepts the right block and names where it fills", () => {
    const v = grade("=FILTER(B2:B6,C2:C6>=300)", spill);
    expect(v.correct).toBe(true);
    expect(v.message).toBe("Correct. The result fills E2:E3.");
    expect(v.spill).toEqual([["Ana"], ["Cy"]]);
  });

  it("explains a block of the wrong size", () => {
    const v = grade("=FILTER(A2:B6,C2:C6>=300)", spill);
    expect(v.rule).toBe("value");
    expect(v.message).toBe(
      "The result fills 2 rows and 2 columns, but this exercise expects 2 rows and 1 column.",
    );
  });

  it("names the first wrong cell", () => {
    const v = grade("=FILTER(B2:B6,C2:C6>=120)", spill);
    expect(v.message).toBe(
      "The result fills 4 rows and 1 column, but this exercise expects 2 rows and 1 column.",
    );
    const sorted = grade("=SORT(FILTER(B2:B6,C2:C6>=300),1,-1)", spill);
    expect(sorted.message).toBe("E2 shows Cy, which is not the result this exercise expects.");
  });

  it("reports #SPILL! when data is in the way", () => {
    const blocked = rows.map((r) => [...r]);
    (blocked[2] as unknown[])[4] = "x";
    const v = grade("=FILTER(B2:B6,C2:C6>=300)", { ...spill, rows: blocked });
    expect(v.correct).toBe(false);
    expect(v.display).toBe("#SPILL!");
  });

  it("explains #CALC! from an empty FILTER", () => {
    const v = grade("=FILTER(B2:B6,C2:C6>=1000)", spill);
    expect(v.message).toBe(
      "E2 shows `#CALC!`: the calculation gave an empty result, such as a FILTER that matched nothing.",
    );
  });
});

describe("grade: variant data", () => {
  const total: GradeSpec = {
    rows,
    answerCell: "E2",
    expected: 240,
    requiredFunctions: [],
    forbiddenFunctions: [],
    requireReference: false,
    variants: [{ set: { C3: 200 }, expected: 320 }],
  };

  it("passes a formula that reads the data", () => {
    expect(grade('=SUMIF(A2:A6,"South",C2:C6)', total).correct).toBe(true);
  });

  it("fails a formula tied to these numbers as fragile", () => {
    const v = grade("=C3+C6", { ...total, variants: [{ set: { A3: "East" }, expected: 120 }] });
    expect(v.rule).toBe("fragile");
    expect(v.message).toBe(
      "Right for this data, but not when the data changes. E2 would show 240 instead of 120. Make the formula work from the cells, not from values you can see.",
    );
    expect(grade("=240", total).rule).toBe("fragile");
  });

  it("says when the variant result is text that looks like the number", () => {
    const v = grade('=SUMIF(A2:A6,"South",C2:C6)&""', { ...total, expected: "240" });
    expect(v.message).toBe(
      "Right for this data, but not when the data changes. E2 would show the text 320 instead of the number 320. Make the formula work from the cells, not from values you can see.",
    );
  });

  it("checks spilled results on the variant too", () => {
    const v = grade("=FILTER(B2:B6,C2:C6>=300)", {
      ...spill,
      variants: [{ set: { C3: 500 }, expected: [["Ana"], ["Bo"], ["Cy"]] }],
    });
    expect(v.correct).toBe(true);
    const typed = grade('=FILTER(B2:B6,(B2:B6="Ana")+(B2:B6="Cy"))', {
      ...spill,
      variants: [{ set: { C3: 500 }, expected: [["Ana"], ["Bo"], ["Cy"]] }],
    });
    expect(typed.rule).toBe("fragile");
  });
});
