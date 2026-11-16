import { describe, expect, it } from "vitest";
import * as grader from "./index.ts";

describe("grader package", () => {
  it("exposes a semantic version string", () => {
    expect(grader.GRADER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("exports the pipeline the brief names", () => {
    for (const name of ["tokenize", "parse", "walkAst", "expandRange", "evaluate", "grade"]) {
      expect(typeof (grader as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("lists the rules in their fixed order", () => {
    expect(grader.RULES).toEqual([
      "syntax",
      "required-function",
      "forbidden-function",
      "reference",
      "value",
      "fragile",
    ]);
  });

  it("knows the functions the content needs", () => {
    expect(grader.knownFunctions()).toEqual(
      expect.arrayContaining(["SUM", "COUNTIFS", "XLOOKUP", "INDEX", "DATE", "TRIM"]),
    );
  });
});
