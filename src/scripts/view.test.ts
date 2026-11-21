import { type GradeSpec, grade } from "@practice/grader";
import { describe, expect, it } from "vitest";
import { compareWithAnswer, outlineClasses, readsLine, verdictView } from "./view.ts";

const spec: GradeSpec = {
  rows: [
    ["Month", "Sales"],
    ["Jan", 120],
    ["Feb", 95],
    ["Mar", 143],
    ["Apr", 88],
    ["Total", null],
  ],
  answerCell: "B6",
  expected: 446,
  requiredFunctions: ["SUM"],
  forbiddenFunctions: [],
  requireReference: true,
};
const values = new Map<string, unknown>([
  ["A2", "Jan"],
  ["B2", 120],
]);
const valueAt = (a: string) => values.get(a);
const text = (segments: { text: string }[]) => segments.map((s) => s.text).join("");

describe("verdictView", () => {
  it("names the rule and the cell, and adds the exercise's miss text", () => {
    const v = verdictView(grade("=SUM(B2:B4)", spec), "B6", { value: "Check the range." }, valueAt);
    expect(v.state).toBe("miss");
    expect(v.label).toBe("Wrong result in B6.");
    expect(text(v.miss)).toBe("Check the range.");
    expect(text(v.reads)).toBe("Your formula reads B2:B4 (3 cells, total 358), outlined in blue.");
  });

  it("drops the grader's Correct prefix, since the label says it", () => {
    const v = verdictView(grade("=SUM(B2:B5)", spec), "B6", {}, valueAt);
    expect(v.label).toBe("Correct.");
    expect(text(v.message)).toBe("B6 shows 446.");
  });

  it("labels each rule", () => {
    const label = (f: string) => verdictView(grade(f, spec), "B6", {}, valueAt).label;
    expect(label("=SUM(B2:B5")).toBe("Formula error in B6.");
    expect(label("=B2+B3")).toBe("Missing function in B6.");
    expect(label("=SUM(120,95)")).toBe("Cell reference problem in B6.");
  });
});

describe("readsLine", () => {
  it("describes single cells by value and mixed ranges by count", () => {
    const reads = grade("=SUM(A2:B3)+B2+A2+C9", spec).reads;
    expect(text(readsLine(reads, valueAt))).toBe(
      "Your formula reads A2:B3 (4 cells, 2 numbers, total 215), B2 (120), A2 (Jan) and C9 (empty), outlined in blue.",
    );
  });

  it("is empty when nothing is read", () => {
    expect(readsLine([], valueAt)).toEqual([]);
  });
});

describe("outlineClasses", () => {
  it("outlines the edges of each range and clips it to the grid", () => {
    const m = outlineClasses(grade("=SUM(B2:B9)", spec).reads, 2, 6);
    expect([...(m.get("B2") ?? [])].sort()).toEqual([
      "read",
      "read-left",
      "read-right",
      "read-top",
    ]);
    expect([...(m.get("B4") ?? [])].sort()).toEqual(["read", "read-left", "read-right"]);
    expect(m.has("B7")).toBe(false);
  });
});

describe("compareWithAnswer", () => {
  const answer = grade("=SUM(B2:B5)", spec).reads;
  const compare = (f: string | null) =>
    compareWithAnswer(f === null ? null : grade(f, spec).reads, answer, 2, 6);

  it("names the cells left out and the extra cells", () => {
    expect(compare("=SUM(B2:B4)")).toBe("Compared with the answer, your formula leaves out B5.");
    expect(compare("=SUM(B1:B5)")).toBe("Your formula also reads B1, which the answer does not.");
    expect(compare("=SUM(A3:A5)")).toBe(
      "Compared with the answer, your formula leaves out B2:B5. Your formula also reads A3:A5, which the answer does not.",
    );
  });

  it("covers no check yet, no cells and the same cells", () => {
    expect(compare(null)).toMatch(/^Check a formula first/u);
    expect(compare("=SUM(1)")).toBe("Your formula reads no cells. The answer reads B2:B5.");
    expect(compare("=MAX(B2:B5)")).toMatch(/^Your formula reads the same cells/u);
  });
});
