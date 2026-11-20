import { describe, expect, it } from "vitest";
import { search } from "./search.ts";
import { pageItems } from "./search-pages.ts";

describe("pageItems", () => {
  const find = (q: string) => search(pageItems(), q).map((i) => i.url);
  it("finds the reference pages by what people call them", () => {
    expect(find("shortcuts")).toContain("/excel-shortcuts/");
    expect(find("keyboard")).toContain("/excel-shortcuts/");
    expect(find("pro")).toContain("/pricing/");
    expect(find("progress")).toContain("/progress/");
  });
  it("marks every one as a page", () => {
    expect(new Set(pageItems().map((i) => i.kind))).toEqual(new Set(["Page"]));
  });
});
