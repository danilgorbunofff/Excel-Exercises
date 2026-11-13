import { describe, expect, it } from "vitest";
import { type SearchItem, search } from "./search.ts";

const items: SearchItem[] = [
  {
    title: "Add two cells",
    url: "/exercises/add-two-cells/",
    kind: "Exercise",
    keywords: "references",
  },
  { title: "SUM", url: "/functions/sum/", kind: "Function", keywords: "add numbers total" },
  {
    title: "Sum a column",
    url: "/exercises/sum-a-column/",
    kind: "Exercise",
    keywords: "SUM totals",
  },
  { title: "VLOOKUP", url: "/functions/vlookup/", kind: "Function", keywords: "lookup table" },
];

describe("search", () => {
  it("puts an exact function name first", () => {
    expect(search(items, "sum").map((i) => i.title)).toEqual(["SUM", "Sum a column"]);
  });
  it("needs every word to match", () => {
    expect(search(items, "sum lookup")).toEqual([]);
  });
  it("finds by keywords", () => {
    expect(search(items, "total").map((i) => i.title)).toEqual(["SUM", "Sum a column"]);
  });
  it("returns nothing for an empty query and respects the limit", () => {
    expect(search(items, "  ")).toEqual([]);
    expect(search(items, "a", 1)).toHaveLength(1);
  });
});
