// ODD, EVEN, XOR and TODAY, checked against Excel's results.
import { describe, expect, it } from "vitest";
import { type ErrorCode, errorValue } from "../errors.ts";
import { evaluate, evaluateFormula } from "../evaluate.ts";
import { grade } from "../grade.ts";
import { createGrid } from "../grid.ts";
import { parse } from "../parse.ts";
import { serialFromDate } from "./date.ts";
import { isKnownFunction } from "./registry.ts";

// A: TRUE, FALSE, TRUE, text, blank. B: text and blanks only. C: an error.
const grid = createGrid([
  [true, "x", null],
  [false, null, null],
  [true, "y", null],
  ["TRUE", null, null],
  [null, null, null],
]);
const ev = (f: string) => evaluateFormula(f, grid);
const E = (c: ErrorCode) => errorValue(c);

describe("the new functions are known to the parser", () => {
  it.each(["ODD", "EVEN", "XOR", "TODAY", "odd", "Today"])("%s", (name) => {
    expect(isKnownFunction(name)).toBe(true);
  });
});

describe("ODD rounds away from zero to an odd whole number", () => {
  it.each([
    ["=ODD(0)", 1],
    ["=ODD(1)", 1],
    ["=ODD(2)", 3],
    ["=ODD(1.5)", 3],
    ["=ODD(3)", 3],
    ["=ODD(-0.5)", -1],
    ["=ODD(-1)", -1],
    ["=ODD(-2)", -3],
    ["=ODD(2.0000001)", 3],
    ["=ODD(TRUE)", 1],
    ["=ODD(FALSE)", 1],
    ['=ODD("4")', 5],
    ["=ODD(E1)", 1],
    ["=ODD(A1)", 1],
  ])("%s is %s", (f, want) => {
    expect(ev(f)).toBe(want);
  });

  it.each([
    ['=ODD("abc")', E("#VALUE!")],
    ["=ODD(B1)", E("#VALUE!")],
    ["=ODD(1/0)", E("#DIV/0!")],
    ["=ODD(#N/A)", E("#N/A")],
  ])("%s is an error", (f, want) => {
    expect(ev(f)).toEqual(want);
  });
});

describe("EVEN rounds away from zero to an even whole number", () => {
  it.each([
    ["=EVEN(0)", 0],
    ["=EVEN(1)", 2],
    ["=EVEN(1.5)", 2],
    ["=EVEN(2)", 2],
    ["=EVEN(3)", 4],
    ["=EVEN(-1)", -2],
    ["=EVEN(-2)", -2],
    ["=EVEN(-2.5)", -4],
    ["=EVEN(TRUE)", 2],
    ["=EVEN(FALSE)", 0],
    ['=EVEN("3")', 4],
    ["=EVEN(E1)", 0],
  ])("%s is %s", (f, want) => {
    expect(ev(f)).toBe(want);
  });

  it.each([
    ['=EVEN("abc")', E("#VALUE!")],
    ["=EVEN(1/0)", E("#DIV/0!")],
  ])("%s is an error", (f, want) => {
    expect(ev(f)).toEqual(want);
  });
});

describe("XOR is TRUE when an odd number of its logicals are TRUE", () => {
  it.each([
    ["=XOR(TRUE)", true],
    ["=XOR(FALSE)", false],
    ["=XOR(TRUE,TRUE)", false],
    ["=XOR(TRUE,FALSE)", true],
    ["=XOR(TRUE,TRUE,TRUE)", true],
    ["=XOR(1,0)", true],
    ["=XOR(2,3)", false],
    // A1:A5 holds TRUE, FALSE, TRUE, text and a blank: two TRUEs; text and blanks are skipped.
    ["=XOR(A1:A5)", false],
    ["=XOR(A1:A5,TRUE)", true],
    ["=XOR(A1:A2)", true],
    ["=XOR(1>0,2>3)", true],
  ])("%s is %s", (f, want) => {
    expect(ev(f)).toBe(want);
  });

  it.each([
    ["=XOR(B1:B5)", E("#VALUE!")],
    ["=XOR(E1:E5)", E("#VALUE!")],
    ['=XOR("abc")', E("#VALUE!")],
    ["=XOR(TRUE,1/0)", E("#DIV/0!")],
    ["=XOR(#N/A,TRUE)", E("#N/A")],
  ])("%s is an error", (f, want) => {
    expect(ev(f)).toEqual(want);
  });
});

describe("TODAY is the serial of the given date, with no time part", () => {
  const today = (formula: string, date: Date) => {
    const r = parse(formula);
    if (!r.ok) throw new Error(`does not parse: ${formula}`);
    return evaluate(r.ast, grid, { today: date });
  };

  it.each([
    [new Date(2026, 10, 15, 23, 59), 46341],
    [new Date(2026, 10, 15, 0, 0), 46341],
    [new Date(2024, 1, 29, 12, 0), 45351],
    [new Date(1900, 0, 1), 1],
  ])("TODAY() on %s is %s", (date, want) => {
    expect(today("=TODAY()", date)).toBe(want);
  });

  it("works inside a formula", () => {
    const d = new Date(2026, 10, 15);
    expect(today("=TODAY()+1", d)).toBe(46342);
    expect(today("=YEAR(TODAY())", d)).toBe(2026);
    expect(today("=TODAY()-DATE(2026,11,1)", d)).toBe(14);
  });

  it("defaults to the real date", () => {
    const now = new Date();
    const want = serialFromDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
    expect([want, want + 1]).toContain(ev("=TODAY()"));
  });

  it("takes no arguments", () => {
    const v = grade("=TODAY(1)", {
      rows: [[1]],
      answerCell: "B1",
      expected: 1,
      requiredFunctions: [],
      forbiddenFunctions: [],
      requireReference: false,
    });
    expect(v.correct).toBe(false);
    expect(v.message).toContain("TODAY takes no arguments.");
  });
});
