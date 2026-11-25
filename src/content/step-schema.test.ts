// Why this exists: proves the ladder-step rule that hints 1 and 2 never quote
// the answer, which only hint 3 may show.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { stepSchema } from "./schema.ts";

const step = () => parse(readFileSync("content/steps/sum-a-column-step-2.yaml", "utf8"));

describe("stepSchema", () => {
  it("accepts a step whose hints state the method", () => {
    expect(stepSchema.safeParse(step()).success).toBe(true);
  });

  it("rejects a hint that quotes the answer, dollar signs or not", () => {
    const s = step();
    s.screens[0].hints.rule = "SUM($B$2:$F$2) adds the five cells.";
    const result = stepSchema.safeParse(s);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["screens", 0, "hints", "rule"]);
  });
});
