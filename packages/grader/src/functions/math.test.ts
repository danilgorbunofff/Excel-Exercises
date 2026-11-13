import { describe, expect, it } from "vitest";
import { type ErrorCode, errorValue } from "../errors.ts";
import { evaluateFormula } from "../evaluate.ts";
import { createGrid } from "../grid.ts";

// A1:A6 mixes types; B1:B3 numbers; C1 holds an error-producing text.
const grid = createGrid([
  [10, 1, "x"],
  ["5", 2, null],
  [true, 3, null],
  [null, null, null],
  ["", null, null],
  [2.5, null, null],
]);
const ev = (f: string) => evaluateFormula(f, grid);
const E = (c: ErrorCode) => errorValue(c);

describe("aggregates skip text, logicals and blanks in ranges", () => {
  it.each([
    ["=SUM(A1:A6)", 12.5],
    ["=AVERAGE(A1:A6)", 6.25],
    ["=MIN(A1:A6)", 2.5],
    ["=MAX(A1:A6)", 10],
    ["=COUNT(A1:A6)", 2],
    ["=COUNTA(A1:A6)", 5],
    ["=COUNTBLANK(A1:A6)", 2],
    ["=PRODUCT(B1:B3)", 6],
    ["=MEDIAN(B1:B3,10)", 2.5],
    ["=SUMPRODUCT(B1:B3,B1:B3)", 14],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });
});

describe("typed arguments are converted", () => {
  it.each([
    ['=SUM("5",TRUE,1)', 7],
    ['=COUNT(1,"2",TRUE,"x")', 3],
    ['=COUNTA(1,"x","")', 3],
    ["=SUM(A2)", 0],
    ["=MAX()+0", 0],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it("rejects typed text that is not a number", () => {
    expect(ev('=SUM("x",1)')).toBe(E("#VALUE!"));
  });
});

describe("errors and empty sets", () => {
  it("propagates errors in ranges", () => {
    const g = createGrid([[1], ["#"], [3]]);
    expect(evaluateFormula("=SUM(A1:A3,1/0)", g)).toBe(E("#DIV/0!"));
  });

  it("AVERAGE of nothing is #DIV/0!; MIN and MAX of nothing are 0", () => {
    expect(ev("=AVERAGE(C2:C4)")).toBe(E("#DIV/0!"));
    expect(ev("=MIN(C2:C4)")).toBe(0);
    expect(ev("=MAX(C1:C4)")).toBe(0);
  });

  it("SUMPRODUCT needs ranges of one shape", () => {
    expect(ev("=SUMPRODUCT(B1:B3,B1:B2)")).toBe(E("#VALUE!"));
  });
});

describe("rounding and arithmetic functions", () => {
  it.each([
    ["=ROUND(2.5,0)", 3],
    ["=ROUND(-2.5,0)", -3],
    ["=ROUND(1.005,2)", 1.01],
    ["=ROUND(1234.5678,-2)", 1200],
    ["=ROUNDUP(1.21,1)", 1.3],
    ["=ROUNDUP(-1.21,1)", -1.3],
    ["=ROUNDDOWN(1.29,1)", 1.2],
    ["=INT(-1.5)", -2],
    ["=ABS(-4)", 4],
    ["=MOD(-3,2)", 1],
    ["=MOD(7,-2)", -1],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it("MOD by zero is #DIV/0!", () => {
    expect(ev("=MOD(1,0)")).toBe(E("#DIV/0!"));
  });
});

describe("logic", () => {
  it.each([
    ['=IF(B1>0,"yes","no")', "yes"],
    ["=IF(0,1)", false],
    ["=IF(1,,2)", 0],
    ["=IF(0,1,)", 0],
    ["=IF(TRUE,1,1/0)", 1],
    ['=IF("true",1,2)', 1],
    ["=AND(B1:B3)", true],
    ["=AND(TRUE,0)", false],
    ["=OR(FALSE,A1:A6)", true],
    ["=NOT(B1)", false],
    ['=IFERROR(1/0,"none")', "none"],
    ["=IFERROR(5,0)", 5],
    ["=IFNA(#N/A,1)", 1],
    ['=IFS(B1>5,"big",B1>0,"small")', "small"],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toEqual(v);
  });

  it.each([
    ['=IF("maybe",1,2)', "#VALUE!"],
    ["=AND(C2:C4)", "#VALUE!"],
    ["=IFNA(1/0,1)", "#DIV/0!"],
    ["=IFS(FALSE,1)", "#N/A"],
  ])("%s is %s", (f, code) => {
    expect(ev(f)).toBe(E(code as ErrorCode));
  });
});
