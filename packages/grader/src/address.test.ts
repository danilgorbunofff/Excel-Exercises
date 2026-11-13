import { describe, expect, it } from "vitest";
import { columnIndex, columnLetters, formatAddress, parseAddress } from "./address.ts";

describe("columns", () => {
  it.each([
    ["A", 1],
    ["Z", 26],
    ["AA", 27],
    ["AZ", 52],
    ["XFD", 16384],
  ])("%s is column %i and back", (letters, index) => {
    expect(columnIndex(letters)).toBe(index);
    expect(columnLetters(index)).toBe(letters);
  });

  it("is case-insensitive", () => {
    expect(columnIndex("ab")).toBe(28);
  });
});

describe("parseAddress", () => {
  it("reads relative, absolute and mixed references", () => {
    expect(parseAddress("B2")).toEqual({ col: 2, row: 2, absCol: false, absRow: false });
    expect(parseAddress("$B$2")).toEqual({ col: 2, row: 2, absCol: true, absRow: true });
    expect(parseAddress("b$10")).toEqual({ col: 2, row: 10, absCol: false, absRow: true });
    expect(parseAddress("$c3")).toEqual({ col: 3, row: 3, absCol: true, absRow: false });
  });

  it("rejects text that is not a cell address or is out of bounds", () => {
    expect(parseAddress("B")).toBeNull();
    expect(parseAddress("2")).toBeNull();
    expect(parseAddress("B0")).toBeNull();
    expect(parseAddress("XFE1")).toBeNull();
    expect(parseAddress("A1048577")).toBeNull();
    expect(parseAddress("SUM")).toBeNull();
  });

  it("formats an address back in upper case without $", () => {
    expect(formatAddress({ col: 28, row: 7 })).toBe("AB7");
  });
});
