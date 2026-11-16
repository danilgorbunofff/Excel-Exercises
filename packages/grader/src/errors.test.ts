import { describe, expect, it } from "vitest";
import { ERROR_CODES, errorValue, isError } from "./errors.ts";

describe("error values", () => {
  it("covers the Excel error codes", () => {
    expect(ERROR_CODES).toEqual([
      "#CALC!",
      "#DIV/0!",
      "#N/A",
      "#NAME?",
      "#NULL!",
      "#NUM!",
      "#REF!",
      "#SPILL!",
      "#VALUE!",
    ]);
  });

  it("creates one shared value per code, so they compare by identity", () => {
    expect(errorValue("#N/A")).toBe(errorValue("#N/A"));
    expect(isError(errorValue("#REF!"))).toBe(true);
    expect(isError("#REF!")).toBe(false);
    expect(isError(null)).toBe(false);
  });
});
