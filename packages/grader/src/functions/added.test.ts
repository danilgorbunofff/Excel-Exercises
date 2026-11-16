// Functions added for the exercises brought over from the earlier project:
// information tests, ranking, rounding to a multiple, SWITCH, splitting text,
// date differences and the code-driven totals SUBTOTAL and AGGREGATE.
import { describe, expect, it } from "vitest";
import { type ErrorCode, errorValue } from "../errors.ts";
import { evaluateFormula } from "../evaluate.ts";
import { createGrid } from "../grid.ts";
import { knownFunctions } from "./registry.ts";

// A: mixed types. B: numbers with a tie. C: dates (serials). D: text codes.
const grid = createGrid([
  [10, 5, 43845, "ORD-4471"], // C1 is 15 January 2020
  ["5", 5, 45000, "a-b-c"], // C2 is 15 March 2023
  [true, 1, 45001, "W-01"],
  [null, 3, null, null],
  ["x", 9, null, null],
]);
const ev = (f: string) => evaluateFormula(f, grid);
const E = (c: ErrorCode) => errorValue(c);

describe("the new functions are known to the parser", () => {
  it.each([
    "ISNUMBER",
    "ISTEXT",
    "ISBLANK",
    "ISNA",
    "ISERROR",
    "LARGE",
    "SMALL",
    "RANK",
    "MODE",
    "MROUND",
    "FLOOR",
    "CEILING",
    "SWITCH",
    "TEXTBEFORE",
    "TEXTAFTER",
    "REPLACE",
    "DATEDIF",
    "HOUR",
    "EDATE",
    "SUBTOTAL",
    "AGGREGATE",
  ])("%s", (name) => {
    expect(knownFunctions()).toContain(name);
  });
});

describe("information tests", () => {
  it.each([
    ["=ISNUMBER(A1)", true],
    ["=ISNUMBER(A2)", false],
    ["=ISNUMBER(A4)", false],
    ["=ISNUMBER(A3)", false],
    ["=ISTEXT(A5)", true],
    ["=ISTEXT(A1)", false],
    ["=ISTEXT(A4)", false],
    ["=ISBLANK(A4)", true],
    ["=ISBLANK(A1)", false],
    ["=ISNA(MATCH(99,B1:B5,0))", true],
    ["=ISNA(1/0)", false],
    ["=ISERROR(1/0)", true],
    ["=ISERROR(INDEX(B1:B5,9))", true],
    ["=ISERROR(A1)", false],
    ['=IF(ISNA(MATCH("W-01",D1:D3,0)),"missing","found")', "found"],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });
});

describe("ranking", () => {
  it.each([
    ["=LARGE(B1:B5,1)", 9],
    ["=LARGE(B1:B5,2)", 5],
    ["=LARGE(B1:B5,3)", 5],
    ["=SMALL(B1:B5,1)", 1],
    ["=SMALL(B1:B5,2)", 3],
    ["=RANK(9,B1:B5)", 1],
    ["=RANK(5,B1:B5)", 2],
    ["=RANK(3,B1:B5)", 4],
    ["=RANK(3,B1:B5,1)", 2],
    ["=RANK(B4,B1:B5)", 4],
    ["=MODE(B1:B5)", 5],
    ["=MODE(1,1,2,2)", 1],
    ["=MODE(2,2,1,1)", 2],
    // Excel 16.109: a tie goes to the value seen first, not the one that reaches the count first.
    ["=MODE(5,3,7,3,5)", 5],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it.each([
    ["=LARGE(B1:B5,6)", "#NUM!"],
    ["=LARGE(B1:B5,0)", "#NUM!"],
    ["=SMALL(A4:A5,1)", "#NUM!"],
    ["=RANK(4,B1:B5)", "#N/A"],
    ["=MODE(1,2,3)", "#N/A"],
  ])("%s is %s", (f, code) => {
    expect(ev(f)).toBe(E(code as ErrorCode));
  });
});

describe("rounding to a multiple", () => {
  it.each([
    ["=MROUND(42,5)", 40],
    ["=MROUND(43,5)", 45],
    ["=MROUND(-7,-2)", -8],
    ["=MROUND(1.3,0.2)", 1.4],
    ["=MROUND(5,0)", 0],
    ["=FLOOR(43,5)", 40],
    ["=FLOOR(42,1)", 42],
    ["=FLOOR(-2.5,2)", -4],
    ["=FLOOR(-2.5,-2)", -2],
    ["=CEILING(43,5)", 45],
    ["=CEILING(-2.5,2)", -2],
    ["=CEILING(-2.5,-2)", -4],
    ["=CEILING(5,0)", 0],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it.each([
    ["=MROUND(-7,2)", "#NUM!"],
    ["=MROUND(7,-2)", "#NUM!"],
    ["=FLOOR(2.5,-2)", "#NUM!"],
    ["=FLOOR(5,0)", "#DIV/0!"],
    ["=CEILING(2.5,-2)", "#NUM!"],
  ])("%s is %s", (f, code) => {
    expect(ev(f)).toBe(E(code as ErrorCode));
  });
});

describe("SWITCH", () => {
  it.each([
    ['=SWITCH(D3,"W-01","Widget","G-02","Gadget","Unknown")', "Widget"],
    ['=SWITCH(D3,"w-01","Widget","Unknown")', "Widget"],
    ['=SWITCH(B3,1,"Bronze",2,"Silver",3,"Gold","None")', "Bronze"],
    ['=SWITCH(B4,1,"Bronze",2,"Silver","None")', "None"],
    ['=SWITCH(1,"1","text","number")', "number"],
    ['=SWITCH(2,1,"one",2,1/0)', E("#DIV/0!")],
    ['=SWITCH(1,1,"one",2,1/0)', "one"],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toEqual(v);
  });

  it("returns #N/A when nothing matches and there is no default", () => {
    expect(ev('=SWITCH(4,1,"one",2,"two")')).toBe(E("#N/A"));
  });
});

describe("splitting and replacing text", () => {
  it.each([
    ['=TEXTBEFORE(D1,"-")', "ORD"],
    ['=TEXTAFTER(D1,"-")', "4471"],
    ['=TEXTBEFORE(D2,"-",2)', "a-b"],
    ['=TEXTAFTER(D2,"-",2)', "c"],
    ['=TEXTAFTER(D2,"-",-1)', "c"],
    ['=TEXTBEFORE(D2,"-",-1)', "a-b"],
    ['=REPLACE("abcdef",2,3,"X")', "aXef"],
    ['=REPLACE(D1,1,3,"INV")', "INV-4471"],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it.each([
    ['=TEXTBEFORE(D3,"/")', "#N/A"],
    ['=TEXTAFTER(D2,"-",3)', "#N/A"],
    ['=TEXTAFTER(D2,"-",0)', "#VALUE!"],
    ['=REPLACE("abc",0,1,"x")', "#VALUE!"],
  ])("%s is %s", (f, code) => {
    expect(ev(f)).toBe(E(code as ErrorCode));
  });
});

describe("HOUR", () => {
  it.each([
    ["=HOUR(0.75)", 18],
    ["=HOUR(C1+0.5)", 12],
    ["=HOUR(C1)", 0],
    ["=HOUR(0.999999)", 23],
    ["=HOUR(1.25)", 6],
  ])("%s is %s", (f, value) => {
    expect(ev(f)).toBe(value);
  });

  it("rejects a negative serial", () => {
    expect(ev("=HOUR(-1)")).toBe(E("#NUM!"));
  });
});

describe("date differences", () => {
  it.each([
    ['=DATEDIF(C1,C2,"Y")', 3],
    ['=DATEDIF(C1,C2,"M")', 38],
    ['=DATEDIF(C1,C3,"M")', 38],
    ['=DATEDIF(C1,C2-1,"M")', 37],
    ['=DATEDIF(C1,C2,"D")', 1155],
    ['=DATEDIF(C1,C2,"YM")', 2],
    ['=DATEDIF(C1,C3,"MD")', 1],
    ['=DATEDIF(C1,C2-1,"MD")', 27],
    ['=DATEDIF(C1,C2,"yd")', 59],
    ['=DATEDIF(C2,C3,"D")', 1],
    ["=EDATE(DATE(2024,1,31),1)", 45351],
    ["=EDATE(DATE(2024,3,15),-2)", 45306],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it.each([
    ['=DATEDIF(C2,C1,"Y")', "#NUM!"],
    ['=DATEDIF(C1,C2,"W")', "#NUM!"],
  ])("%s is %s", (f, code) => {
    expect(ev(f)).toBe(E(code as ErrorCode));
  });
});

describe("SUBTOTAL and AGGREGATE", () => {
  it.each([
    ["=SUBTOTAL(9,B1:B5)", 23],
    ["=SUBTOTAL(109,B1:B5)", 23],
    ["=SUBTOTAL(1,B1:B3)", 11 / 3],
    ["=SUBTOTAL(2,A1:A5)", 1],
    ["=SUBTOTAL(3,A1:A5)", 4],
    ["=SUBTOTAL(4,B1:B5)", 9],
    ["=SUBTOTAL(5,B1:B5)", 1],
    ["=SUBTOTAL(6,B3:B4)", 3],
    ["=AGGREGATE(9,6,B1:B5)", 23],
    ["=AGGREGATE(4,0,B1:B5)", 9],
    ["=AGGREGATE(14,6,B1:B5,2)", 5],
    ["=AGGREGATE(15,6,B1:B5,1)", 1],
    ["=AGGREGATE(12,6,B1:B5)", 5],
    ["=ROUND(AGGREGATE(1,6,B1:B3),1)", 3.7],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it.each([
    ["=SUBTOTAL(12,B1:B5)", "#VALUE!"],
    ["=SUBTOTAL(1,A4:A5)", "#DIV/0!"],
    ["=AGGREGATE(9,8,B1:B5)", "#VALUE!"],
    ["=AGGREGATE(14,6,B1:B5)", "#VALUE!"],
  ])("%s is %s", (f, code) => {
    expect(ev(f)).toBe(E(code as ErrorCode));
  });
});
