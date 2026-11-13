import { describe, expect, it } from "vitest";
import { type ErrorCode, errorValue } from "../errors.ts";
import { evaluateFormula } from "../evaluate.ts";
import { createGrid } from "../grid.ts";
import { criteriaMatcher, wildcardRegExp } from "./criteria.ts";

// A: region, B: sales, C: rep
const grid = createGrid([
  ["Region", "Sales", "Rep"],
  ["West", 100, "Ann"],
  ["east", 250, "Bob"],
  ["West", 50, "Anna"],
  ["North", "n/a", "Al"],
  [null, 75, "A*"],
  ["Westfield", 10, ""],
]);
const ev = (f: string) => evaluateFormula(f, grid);

describe("criteria", () => {
  it.each([
    ['=COUNTIF(A2:A7,"West")', 2],
    ['=COUNTIF(A2:A7,"west")', 2],
    ['=COUNTIF(A2:A7,"West*")', 3],
    ['=COUNTIF(A2:A7,"?ast")', 1],
    ['=COUNTIF(A2:A7,"<>West")', 4],
    ['=COUNTIF(B2:B7,">60")', 3],
    ['=COUNTIF(B2:B7,">=100")', 2],
    ['=COUNTIF(B2:B7,"<>100")', 5],
    ["=COUNTIF(B2:B7,100)", 1],
    ['=COUNTIF(B2:B7,"100")', 1],
    ['=COUNTIF(A2:A7,"")', 1],
    ['=COUNTIF(A2:A7,"=")', 1],
    ['=COUNTIF(A2:A7,"<>")', 5],
    ['=COUNTIF(C2:C7,"")', 1],
    ['=COUNTIF(C2:C7,"A~*")', 1],
    ['=COUNTIF(C2:C7,"A*")', 4],
    ['=COUNTIF(A2:A7,"<N")', 1],
    ['=COUNTIF(B2:B7,">"&B3)', 0],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it("matches numbers stored as text when the criteria is a number", () => {
    const m = criteriaMatcher(5);
    expect(m("5")).toBe(true);
    expect(m(5)).toBe(true);
    expect(m("five")).toBe(false);
  });

  it("builds whole-text, case-insensitive wildcard patterns", () => {
    expect(wildcardRegExp("a*b").test("AXXB")).toBe(true);
    expect(wildcardRegExp("a*b").test("xAb")).toBe(false);
    expect(wildcardRegExp("1.5").test("125")).toBe(false);
  });
});

describe("SUMIF and AVERAGEIF", () => {
  it.each([
    ['=SUMIF(A2:A7,"West",B2:B7)', 150],
    ['=SUMIF(B2:B7,">60")', 425],
    ['=SUMIF(A2:A7,"North",B2:B7)', 0],
    ['=AVERAGEIF(A2:A7,"West",B2:B7)', 75],
    ['=SUMIFS(B2:B7,A2:A7,"West",C2:C7,"Ann*")', 150],
    ['=SUMIFS(B2:B7,A2:A7,"West",B2:B7,">60")', 100],
    ['=COUNTIFS(A2:A7,"West*",B2:B7,"<60")', 2],
    ['=AVERAGEIFS(B2:B7,C2:C7,"A*")', 75],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it.each([
    ['=AVERAGEIF(A2:A7,"South",B2:B7)', "#DIV/0!"],
    ['=SUMIFS(B2:B7,A2:A6,"West")', "#VALUE!"],
    ['=COUNTIFS(A2:A7,"West",B2:B6,">1")', "#VALUE!"],
  ])("%s is %s", (f, code) => {
    expect(ev(f)).toBe(errorValue(code as ErrorCode));
  });
});
