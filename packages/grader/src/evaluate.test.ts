import { describe, expect, it } from "vitest";
import { errorValue } from "./errors.ts";
import { evaluateFormula } from "./evaluate.ts";
import { createGrid } from "./grid.ts";

// A1:C4
const grid = createGrid([
  ["Item", "Qty", "Note"],
  ["Pens", 10, "3"],
  ["Ink", 0, null],
  ["Pads", 4.5, "x"],
]);
const ev = (f: string) => evaluateFormula(f, grid);
const E = (code: Parameters<typeof errorValue>[0]) => errorValue(code);

describe("evaluate: arithmetic and precedence", () => {
  it.each([
    ["=1+2*3", 7],
    ["=(1+2)*3", 9],
    ["=-2^2", 4],
    ["=2^3^2", 64],
    ["=10-2-3", 5],
    ["=50%*4", 2],
    ["=7/2", 3.5],
    ["=B2*2", 20],
    ["=B2+C2", 13],
    ["=C3+1", 1],
    ["=-C2", -3],
    ["=+B4", 4.5],
    ["=TRUE+1", 2],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });
});

describe("evaluate: errors", () => {
  it.each([
    ["=B2/B3", "#DIV/0!"],
    ["=B2/C3", "#DIV/0!"],
    ["=A2+1", "#VALUE!"],
    ["=C4*2", "#VALUE!"],
    ["=0^0", "#NUM!"],
    ["=(-8)^0.5", "#NUM!"],
    ["=total", "#NAME?"],
    ["=NOSUCH(1)", "#NAME?"],
    ["=#N/A+1", "#N/A"],
  ])("%s is %s", (f, code) => {
    expect(ev(f)).toBe(E(code as Parameters<typeof errorValue>[0]));
  });

  it("returns the first error from the left", () => {
    expect(ev("=#N/A+#REF!")).toBe(E("#N/A"));
    expect(ev("=1/0&#N/A")).toBe(E("#DIV/0!"));
  });
});

describe("evaluate: text and comparisons", () => {
  it.each([
    ['=A2&" x"&B2', "Pens x10"],
    ["=A3&C3", "Ink"],
    ['=1/4&""', "0.25"],
    ["=TRUE&1", "TRUE1"],
    ['="a"="A"', true],
    ["=B2>B4", true],
    ["=C3=0", true],
    ['=C3=""', true],
    ['=A2<>"pens"', false],
    ['=B2<"a"', true],
    ["=B2>=10", true],
    ["=1<=0", false],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });
});

describe("evaluate: references", () => {
  it("returns a cell's value, and 0 for an empty cell used alone", () => {
    expect(ev("=A2")).toBe("Pens");
    expect(ev("=C3")).toBe(0);
    expect(ev("=Z99")).toBe(0);
  });

  it("returns a range as a range, for the grader to report", () => {
    expect(ev("=B2:B4")).toEqual({
      kind: "range",
      origin: { col: 2, row: 2 },
      rows: [[10], [0], [4.5]],
    });
  });

  it("returns a one-cell range as its value", () => {
    expect(ev("=B2:B2")).toBe(10);
  });

  it("treats the formula's own cell as empty", () => {
    const g = createGrid([[1], [2], [null]]);
    expect(evaluateFormula("=A1+A2+A3", g, { col: 1, row: 3 })).toBe(3);
  });
});
