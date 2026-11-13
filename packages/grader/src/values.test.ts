import { describe, expect, it } from "vitest";
import { errorValue } from "./errors.ts";
import { compare, formatNumber, toBool, toNumber, toText } from "./values.ts";

const VALUE = errorValue("#VALUE!");

describe("toNumber", () => {
  it.each([
    [5, 5],
    [true, 1],
    [false, 0],
    [null, 0],
    ["12", 12],
    [" 3.5 ", 3.5],
    ["1,000", 1000],
    ["50%", 0.5],
    ["-2", -2],
    ["1e3", 1000],
  ])("%j becomes %j", (input, expected) => {
    expect(toNumber(input)).toBe(expected);
  });

  it.each([["abc"], [""], ["12abc"]])("text %j that is not a number is #VALUE!", (input) => {
    expect(toNumber(input)).toBe(VALUE);
  });

  it("passes errors through", () => {
    expect(toNumber(errorValue("#N/A"))).toBe(errorValue("#N/A"));
  });
});

describe("toText", () => {
  it.each([
    [12, "12"],
    [0.5, "0.5"],
    [1 / 3, "0.333333333333333"],
    [-1.25, "-1.25"],
    [1e15, "1E+15"],
    [0.0000001, "0.0000001"],
    [0.1 + 0.2, "0.3"],
    [true, "TRUE"],
    [null, ""],
    ["a", "a"],
  ])("%j becomes %j", (input, expected) => {
    expect(toText(input)).toBe(expected);
  });

  it("formats numbers like Excel's General format", () => {
    expect(formatNumber(123456789012)).toBe("123456789012");
    expect(formatNumber(2.5e-12)).toBe("2.5E-12");
  });
});

describe("toBool", () => {
  it.each([
    [true, true],
    [0, false],
    [-3, true],
    [null, false],
    ["true", true],
    ["FALSE", false],
  ])("%j becomes %j", (input, expected) => {
    expect(toBool(input)).toBe(expected);
  });

  it("rejects other text", () => {
    expect(toBool("yes")).toBe(VALUE);
  });
});

describe("compare", () => {
  it("compares numbers, text without case, and logicals", () => {
    expect(compare(1, 2)).toBe(-1);
    expect(compare("apple", "APPLE")).toBe(0);
    expect(compare("b", "A")).toBe(1);
    expect(compare(false, true)).toBe(-1);
  });

  it("orders mixed types as numbers, then text, then logicals", () => {
    expect(compare(999, "a")).toBe(-1);
    expect(compare("z", true)).toBe(-1);
    expect(compare(true, 5)).toBe(1);
  });

  it("treats a blank as 0, empty text or FALSE, depending on the other side", () => {
    expect(compare(null, 0)).toBe(0);
    expect(compare(null, "")).toBe(0);
    expect(compare(null, false)).toBe(0);
    expect(compare(null, null)).toBe(0);
    expect(compare(null, -1)).toBe(1);
  });
});
