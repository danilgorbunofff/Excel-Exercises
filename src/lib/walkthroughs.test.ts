import { describe, expect, it } from "vitest";
import { walkthroughsFor } from "./walkthroughs.ts";

const w = (slug: string, formula: string) => ({ slug, formula });
const all = [
  w("sum-less-costs", "=SUM(B2:B4)-SUM(C2:C4)"),
  w("sumifs", '=SUMIFS(C2:C7,A2:A7,"North")'),
  w("index-match", '=INDEX(C2:C6,MATCH("P-104",A2:A6,0))'),
  w("lower", "=sum(B2:B4)"),
];

describe("walkthroughsFor", () => {
  it("finds the walkthroughs whose formula calls the function", () => {
    expect(walkthroughsFor("MATCH", all).map((x) => x.slug)).toEqual(["index-match"]);
  });
  it("does not take SUMIFS for SUM, and ignores case", () => {
    expect(walkthroughsFor("SUM", all).map((x) => x.slug)).toEqual(["sum-less-costs", "lower"]);
  });
  it("returns nothing for a function no walkthrough uses", () => {
    expect(walkthroughsFor("VLOOKUP", all)).toEqual([]);
  });
});
