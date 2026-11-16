import { describe, expect, it } from "vitest";
import { byFunction, scoreAttempt, type TaskData } from "./assessment-score.ts";

const task: TaskData = {
  exercise: "sum-a-column",
  screen: 0,
  title: "Add up a column",
  href: "/exercises/sum-a-column/",
  spec: {
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
  },
  misses: {},
  slug: "sum-a-column",
  answer: "=SUM(B2:B5)",
  skills: ["SUM"],
};

describe("scoreAttempt", () => {
  it("marks right, wrong and blank answers", () => {
    const [right, wrong, blank] = scoreAttempt(
      ["=SUM(B2:B5)", "=SUM(B2:B4)", "  "],
      [task, task, task],
    );
    expect(right).toMatchObject({ correct: true, rule: null });
    expect(wrong).toMatchObject({ correct: false, rule: "value" });
    expect(blank).toMatchObject({ correct: false, rule: null, verdict: null, formula: "" });
  });

  it("treats a missing formula as blank", () => {
    expect(scoreAttempt([], [task])[0]?.correct).toBe(false);
  });
});

describe("byFunction", () => {
  const withFns = (fns: string[], correct: boolean) => ({
    correct,
    task: { skills: fns },
  });
  it("counts each function, weakest first, and puts no-function tasks under References", () => {
    expect(
      byFunction([
        withFns(["SUM"], true),
        withFns(["SUM", "IF"], false),
        withFns([], true),
        withFns(["IF"], false),
      ]),
    ).toEqual([
      { name: "IF", correct: 0, total: 2 },
      { name: "SUM", correct: 1, total: 2 },
      { name: "References", correct: 1, total: 1 },
    ]);
  });
});
