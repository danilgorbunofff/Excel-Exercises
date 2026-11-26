// Why this exists: proves the rule that hints 1 and 2 of a ladder step or a
// drill never quote the answer, which only hint 3 may show.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { drillSchema, stepSchema } from "./schema.ts";

const step = () => parse(readFileSync("content/steps/sum-a-column-step-2.yaml", "utf8"));
const drill = () => parse(readFileSync("content/drills/and-drill-3.yaml", "utf8"));

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

describe("drillSchema", () => {
  it("accepts a drill whose hints state the method", () => {
    expect(drillSchema.safeParse(drill()).success).toBe(true);
  });

  it("rejects a hint that quotes the answer", () => {
    const d = drill();
    d.screens[0].hints.rule = "AND(B2>=C2,B2<=D2) is TRUE when the value sits between the limits.";
    const result = drillSchema.safeParse(d);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["screens", 0, "hints", "rule"]);
  });
});
