import { describe, expect, it } from "vitest";
import { evaluateFormula } from "../evaluate.ts";
import { createGrid } from "../grid.ts";
import { formatCode } from "./format-code.ts";

const show = (v: string | number | boolean | null, code: string) =>
  formatCode(v, code)?.text ?? null;
// 2024-03-05 13:30, a Tuesday.
const WHEN = 45356 + 0.5625;

describe("format codes, numbers (en-US)", () => {
  it.each([
    [1234.5, "0", "1235"],
    [1234.5, "#,##0.00", "1,234.50"],
    [1234567, "#,##0", "1,234,567"],
    [7, "000", "007"],
    [5, "0.##", "5."],
    [0.5, "#.00", ".50"],
    [0.256, "0.0%", "25.6%"],
    [1234567, '0.0,,"M"', "1.2M"],
    [45000, '0,"K"', "45K"],
    [1234.5, "$#,##0.00", "$1,234.50"],
    [-1234.5, "$#,##0.00", "-$1,234.50"],
    [-1234, "#,##0;(#,##0)", "(1,234)"],
    [-5, "0;[Red]-0", "-5"],
    [5, "0;[Red]-0", "5"],
    [0, '0;-0;"–"', "–"],
    [0, "0;-0;;@", ""],
    [12, '0" kg"', "12 kg"],
    [123456789, "000-00-0000", "123-45-6789"],
    [5551234567, "(000) 000-0000", "(555) 123-4567"],
    [1.5, "0.0?", "1.5 "],
    [12345, "0.00E+00", "1.23E+04"],
    [0.00012, "0.00E+00", "1.20E-04"],
    [12345, "##0.0E+0", "12.3E+3"],
    [1500, '[>=1000000]0.0,,"M";[>=1000]0.0,"K";0', "1.5K"],
    [2500000, '[>=1000000]0.0,,"M";[>=1000]0.0,"K";0', "2.5M"],
    [42, '[>=1000000]0.0,,"M";[>=1000]0.0,"K";0', "42"],
    [5, "0_);(0)", "5 "],
    [5, "**0", "5"],
    [1234.5, "General", "1234.5"],
    [12.5, '"Total: "General', "Total: 12.5"],
    [5, "[$€-407]0.00", "€5.00"],
  ])("%s with %s is %s", (v, code, want) => {
    expect(show(v, code)).toBe(want);
  });
});

describe("format codes, dates and times (en-US)", () => {
  it.each([
    ["dd-mmm-yyyy", "05-Mar-2024"],
    ["yyyy-mm-dd", "2024-03-05"],
    ["m/d/yy", "3/5/24"],
    ["dddd", "Tuesday"],
    ["ddd d mmmm", "Tue 5 March"],
    ["mmmmm", "M"],
    ["h:mm AM/PM", "1:30 PM"],
    ["hh:mm", "13:30"],
    ["h:mm a/p", "1:30 p"],
    ["mm:ss", "30:00"],
    ['"Due "mmm d', "Due Mar 5"],
  ])("%s", (code, want) => {
    expect(show(WHEN, code)).toBe(want);
  });

  it("counts elapsed time past 24 hours", () => {
    expect(show(1.25, "[h]:mm")).toBe("30:00");
    expect(show(0.0625, "[mm]:ss")).toBe("90:00");
    expect(show(1.5 / 86400, "ss.00")).toBe("01.50");
  });

  it("rolls 23:59:59.6 over to the next minute and day", () => {
    expect(show(45356 + 86399.6 / 86400, "d h:mm:ss")).toBe("6 0:00:00");
  });
});

describe("format codes, sections and colour", () => {
  it("reports the colour of the section used", () => {
    expect(formatCode(-5, "0;[Red]-0")).toEqual({ text: "-5", color: "red" });
    expect(formatCode(5, "[Blue]0;[Red]-0")).toEqual({ text: "5", color: "blue" });
    expect(formatCode(5, "[Color10]0")?.color).toBe("color10");
  });

  it("uses the fourth section, or @, for text", () => {
    expect(show("abc", '0;-0;0;"Code: "@')).toBe("Code: abc");
    expect(show("abc", '"Code: "@')).toBe("Code: abc");
    expect(show("abc", "0.00")).toBe("abc");
  });

  it("keeps ; inside quotes", () => {
    expect(show(5, '0" a;b"')).toBe("5 a;b");
  });

  it("refuses codes it cannot draw", () => {
    expect(formatCode(0.5, "# ?/?")).toBeNull();
    expect(formatCode(5, "[Purple]0")).toBeNull();
  });
});

describe("TEXT uses the format codes", () => {
  const grid = createGrid([[45356]]);
  it.each([
    ['=TEXT(-5,"0;[Red]-0")', "-5"],
    ['=TEXT(1234567,"0.0,,""M""")', "1.2M"],
    ['=TEXT(A1,"dddd")', "Tuesday"],
    ['=TEXT(0.5,"# ?/?")', { code: "#VALUE!" }],
  ])("%s", (f, want) => {
    const got = evaluateFormula(f, grid);
    if (typeof want === "string") expect(got).toBe(want);
    else expect(got).toMatchObject(want);
  });
});
