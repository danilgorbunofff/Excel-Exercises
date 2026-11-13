import { describe, expect, it } from "vitest";
import { relatedArticles } from "./related.ts";

const a = (id: string, functions: string[]) => ({ id, data: { functions } });
const all = [
  a("errors", ["IF", "VLOOKUP", "XLOOKUP"]),
  a("references", []),
  a("lookups", ["VLOOKUP", "XLOOKUP", "INDEX"]),
  a("counting", ["COUNTIF"]),
];

describe("relatedArticles", () => {
  it("leaves out the article being read", () => {
    expect(relatedArticles(all, "errors").map((x) => x.id)).not.toContain("errors");
  });
  it("puts articles that share functions first, then the rest in their order", () => {
    expect(relatedArticles(all, "errors").map((x) => x.id)).toEqual([
      "lookups",
      "references",
      "counting",
    ]);
  });
  it("returns at most the limit", () => {
    expect(relatedArticles(all, "errors", 1).map((x) => x.id)).toEqual(["lookups"]);
  });
  it("returns nothing when it is the only article", () => {
    expect(relatedArticles([a("only", [])], "only")).toEqual([]);
  });
});
