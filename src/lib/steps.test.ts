import { describe, expect, it } from "vitest";
import { originalSlot, parentOf, type Rung, reviewStep, stepId } from "./steps.ts";

const ladder: Rung[] = [1, 2, 3, 4, 5].map((step) => ({
  id: step === 3 ? "sum-a-column" : stepId("sum-a-column", step),
  step,
  href: "",
}));
const solved = (days: Record<string, string>) => (id: string) => days[id];

describe("step ids", () => {
  it("names a step after its parent and finds the parent again", () => {
    expect(stepId("sum-a-column", 2)).toBe("sum-a-column-step-2");
    expect(parentOf("sum-a-column-step-2")).toBe("sum-a-column");
    expect(parentOf("sum-a-column")).toBeNull();
    expect(parentOf("sum-drill-2")).toBeNull();
  });

  it("finds the one slot the exercise itself fills", () => {
    expect(originalSlot([1, 2, 4, 5])).toBe(3);
    expect(originalSlot([2, 3, 4, 5])).toBe(1);
    expect(originalSlot([1, 2, 4])).toBeNull();
    expect(originalSlot([])).toBeNull();
  });
});

describe("reviewStep", () => {
  it("goes one step above the hardest solved", () => {
    expect(reviewStep(ladder, solved({ "sum-a-column": "2026-11-01" }))?.step).toBe(4);
    expect(
      reviewStep(
        ladder,
        solved({ "sum-a-column": "2026-11-01", "sum-a-column-step-4": "2026-11-02" }),
      )?.step,
    ).toBe(5);
  });

  it("steps down when the top is solved, then repeats the oldest solve", () => {
    expect(reviewStep(ladder, solved({ "sum-a-column-step-5": "2026-11-01" }))?.step).toBe(4);
    const all = Object.fromEntries(ladder.map((r, i) => [r.id, `2026-11-0${9 - i}`]));
    expect(reviewStep(ladder, solved(all))?.step).toBe(5);
  });

  it("gives nothing for an empty ladder", () => {
    expect(reviewStep([], () => undefined)).toBeNull();
  });
});
