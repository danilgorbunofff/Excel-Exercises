import { describe, expect, it } from "vitest";
import { type ErrorCode, errorValue } from "../errors.ts";
import { evaluateFormula } from "../evaluate.ts";
import { createGrid } from "../grid.ts";

// A1:C6 products sorted by code; E1:F4 a sorted rate table; H1:H3 codes stored as text.
const grid = createGrid([
  ["Code", "Name", "Price", null, "From", "Rate", null, "Text code"],
  [101, "Pen", 1.5, null, 0, 0.05, null, "101"],
  [102, "Pad", 4, null, 100, 0.1, null, "102"],
  [105, "Ink", 12, null, 500, 0.15, null, null],
  [110, "Tape", 3, null, null, null, null, null],
  [120, "Pen", 2, null, null, null, null, null],
]);
const ev = (f: string) => evaluateFormula(f, grid);
const E = (c: ErrorCode) => errorValue(c);

describe("VLOOKUP and HLOOKUP", () => {
  it.each([
    ["=VLOOKUP(105,A2:C6,2,FALSE)", "Ink"],
    ["=VLOOKUP(105,A2:C6,3,0)", 12],
    ['=VLOOKUP("pad",B2:C6,2,FALSE)', 4],
    ['=VLOOKUP("P*",B2:C6,2,FALSE)', 1.5],
    ["=VLOOKUP(250,E2:F4,2)", 0.1],
    ["=VLOOKUP(250,E2:F4,2,TRUE)", 0.1],
    ["=VLOOKUP(9999,E2:F4,2)", 0.15],
    ["=VLOOKUP(108,A2:C6,2,)", E("#N/A")],
    ['=HLOOKUP("Price",A1:C3,3,FALSE)', 4],
  ])("%s", (f, v) => {
    expect(ev(f)).toEqual(v);
  });

  it.each([
    ["=VLOOKUP(108,A2:C6,2,FALSE)", "#N/A"],
    ["=VLOOKUP(-1,E2:F4,2)", "#N/A"],
    ["=VLOOKUP(101,A2:C6,4,FALSE)", "#REF!"],
    ["=VLOOKUP(101,A2:C6,0,FALSE)", "#VALUE!"],
    ["=VLOOKUP(101,H2:H3,1,FALSE)", "#N/A"],
  ])("%s is %s", (f, code) => {
    expect(ev(f)).toBe(E(code as ErrorCode));
  });
});

describe("MATCH and INDEX", () => {
  it.each([
    ["=MATCH(105,A2:A6,0)", 3],
    ['=MATCH("ink",B2:B6,0)', 3],
    ["=MATCH(107,A2:A6)", 3],
    ["=MATCH(107,A2:A6,1)", 3],
    ["=INDEX(B2:B6,3)", "Ink"],
    ["=INDEX(A2:C6,2,3)", 4],
    ["=INDEX(A1:C1,2)", "Name"],
    ["=INDEX(B2:B6,MATCH(110,A2:A6,0))", "Tape"],
    ["=SUM(INDEX(C2:C6,0))", 22.5],
    ['=MATCH("P?d",B2:B6,0)', 2],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toEqual(v);
  });

  it("MATCH with -1 finds the smallest value not below the lookup in descending data", () => {
    const g = createGrid([[50], [30], [10]]);
    expect(evaluateFormula("=MATCH(25,A1:A3,-1)", g)).toBe(2);
  });

  it.each([
    ["=MATCH(999,A2:A6,0)", "#N/A"],
    ["=MATCH(1,A2:B3,0)", "#N/A"],
    ["=INDEX(B2:B6,9)", "#REF!"],
  ])("%s is %s", (f, code) => {
    expect(ev(f)).toBe(E(code as ErrorCode));
  });
});

describe("XLOOKUP", () => {
  it.each([
    ["=XLOOKUP(105,A2:A6,B2:B6)", "Ink"],
    ['=XLOOKUP("pen",B2:B6,C2:C6)', 1.5],
    ['=XLOOKUP("pen",B2:B6,C2:C6,,0,-1)', 2],
    ['=XLOOKUP(999,A2:A6,B2:B6,"none")', "none"],
    ["=XLOOKUP(107,A2:A6,B2:B6,,-1)", "Ink"],
    ["=XLOOKUP(107,A2:A6,B2:B6,,1)", "Tape"],
    ['=XLOOKUP("T*",B2:B6,C2:C6,,2)', 3],
    ['=XLOOKUP("Name",A1:C1,A3:C3)', "Pad"],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toEqual(v);
  });

  it("does not use wildcards in exact mode", () => {
    expect(ev('=XLOOKUP("T*",B2:B6,C2:C6)')).toBe(E("#N/A"));
  });

  it("returns a whole row when the return range is wider", () => {
    expect(ev("=XLOOKUP(102,A2:A6,B2:C6)")).toEqual({
      kind: "range",
      origin: { col: 2, row: 3 },
      rows: [["Pad", 4]],
    });
  });

  it("needs a return range as long as the lookup range", () => {
    expect(ev("=XLOOKUP(102,A2:A6,B2:B5)")).toBe(E("#VALUE!"));
  });
});
