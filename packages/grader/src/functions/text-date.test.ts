import { describe, expect, it } from "vitest";
import { type ErrorCode, errorValue } from "../errors.ts";
import { evaluateFormula } from "../evaluate.ts";
import { createGrid } from "../grid.ts";
import { dateFromSerial, serialFromDate } from "./date.ts";

const grid = createGrid([
  ["  Ann   Lee ", "ann", 45292],
  ["SKU-1042", null, 45351],
  ["hello WORLD", 12.5, "x"],
]);
const ev = (f: string) => evaluateFormula(f, grid);

describe("text functions", () => {
  it.each([
    ['=LEFT("Excel",2)', "Ex"],
    ['=LEFT("Excel")', "E"],
    ["=RIGHT(A2,4)", "1042"],
    ["=MID(A2,5,4)", "1042"],
    ["=LEN(A1)", 12],
    ["=TRIM(A1)", "Ann Lee"],
    ["=UPPER(B1)", "ANN"],
    ["=LOWER(A3)", "hello world"],
    ["=PROPER(A3)", "Hello World"],
    ['=CONCAT(B1," ",A3)', "ann hello WORLD"],
    ["=CONCAT(A2:B2)", "SKU-1042"],
    ['=CONCATENATE("a",B3)', "a12.5"],
    ['=TEXTJOIN(", ",TRUE,A2:B2,"z")', "SKU-1042, z"],
    ["=VALUE(RIGHT(A2,4))+1", 1043],
    ['=EXACT("a","A")', false],
    ['=SUBSTITUTE("a-b-c","-","/")', "a/b/c"],
    ['=SUBSTITUTE("a-b-c","-","/",2)', "a-b/c"],
    ['=FIND("-",A2)', 4],
    ['=SEARCH("w*",A3)', 7],
    ['=SEARCH("W",A3)', 7],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it.each([
    ['=FIND("x",A2)', "#VALUE!"],
    ['=LEFT("a",-1)', "#VALUE!"],
    ['=MID("a",0,1)', "#VALUE!"],
    ['=VALUE("abc")', "#VALUE!"],
  ])("%s is %s", (f, code) => {
    expect(ev(f)).toBe(errorValue(code as ErrorCode));
  });

  // Checked in Excel 365: CONCATENATE takes one value per argument, so a range
  // there runs it once per cell and spills, where CONCAT joins the range.
  it("=CONCATENATE(A1:A2) spills one result per cell", () => {
    expect(ev("=CONCATENATE(A1:A2)")).toMatchObject({ rows: [["  Ann   Lee "], ["SKU-1042"]] });
  });
});

describe("dates as serial numbers", () => {
  it.each([
    [1900, 1, 1, 1],
    [1900, 2, 28, 59],
    [1900, 2, 29, 60],
    [1900, 3, 1, 61],
    [2024, 1, 1, 45292],
    [2024, 2, 29, 45351],
    [2024, 13, 1, 45658],
    [2024, 3, 0, 45351],
  ])("DATE(%i,%i,%i) is %i", (y, m, d, s) => {
    expect(serialFromDate(y, m, d)).toBe(s);
  });

  it("converts serial numbers back, including the 1900 quirk", () => {
    expect(dateFromSerial(45351)).toEqual({ year: 2024, month: 2, day: 29 });
    expect(dateFromSerial(60)).toEqual({ year: 1900, month: 2, day: 29 });
    expect(dateFromSerial(61)).toEqual({ year: 1900, month: 3, day: 1 });
    expect(dateFromSerial(1)).toEqual({ year: 1900, month: 1, day: 1 });
  });

  it.each([
    ["=DATE(2024,1,1)", 45292],
    ["=DATE(24,1,1)", 8767],
    ["=DATE(2000,1,1)", 36526],
    ["=YEAR(C1)", 2024],
    ["=MONTH(C2)", 2],
    ["=DAY(C2)", 29],
    ["=WEEKDAY(C1)", 2],
    ["=WEEKDAY(C1,2)", 1],
    ["=EOMONTH(C1,1)", 45351],
    ["=DAYS(C2,C1)", 59],
    ["=C2-C1", 59],
    ['=COUNTIF(C1:C3,">="&DATE(2024,2,1))', 1],
  ])("%s is %j", (f, v) => {
    expect(ev(f)).toBe(v);
  });

  it("rejects negative serials and years out of range", () => {
    expect(ev("=YEAR(-1)")).toBe(errorValue("#NUM!"));
    expect(ev("=DATE(10000,1,1)")).toBe(errorValue("#NUM!"));
    expect(ev("=YEAR(C3)")).toBe(errorValue("#VALUE!"));
  });
});
