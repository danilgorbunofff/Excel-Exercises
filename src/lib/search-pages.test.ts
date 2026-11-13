import { describe, expect, it } from "vitest";
import { search } from "./search.ts";
import { pageItems, walkthroughItems } from "./search-pages.ts";

describe("walkthroughItems", () => {
  const items = walkthroughItems([
    {
      slug: "xlookup-fallback",
      title: "XLOOKUP with a fallback",
      description: "Look up a value and show your own text when it is missing.",
      formula: '=XLOOKUP("Leeds",A2:A5,B2:B5,"Not listed")',
    },
  ]);
  it("lists each walkthrough at its own address", () => {
    expect(items).toEqual([
      {
        title: "XLOOKUP with a fallback",
        url: "/formula-explainer/xlookup-fallback/",
        kind: "Walkthrough",
        keywords:
          'Look up a value and show your own text when it is missing. =XLOOKUP("Leeds",A2:A5,B2:B5,"Not listed")',
      },
    ]);
  });
  it("is found by a word from its description", () => {
    expect(search(items, "missing").map((i) => i.title)).toEqual(["XLOOKUP with a fallback"]);
  });
});

describe("pageItems", () => {
  const find = (q: string) => search(pageItems(), q).map((i) => i.url);
  it("finds the tools and reference pages by what people call them", () => {
    expect(find("shortcuts")).toContain("/excel-shortcuts/");
    expect(find("keyboard")).toContain("/excel-shortcuts/");
    expect(find("explainer")).toContain("/formula-explainer/");
    expect(find("resources")).toContain("/resources/");
    expect(find("pro")).toContain("/pricing/");
    expect(find("progress")).toContain("/progress/");
  });
  it("marks every one as a page", () => {
    expect(new Set(pageItems().map((i) => i.kind))).toEqual(new Set(["Page"]));
  });
});
