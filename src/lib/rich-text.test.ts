import { describe, expect, it } from "vitest";
import { describeCells, richText } from "./rich-text.ts";

describe("richText", () => {
  it("splits code in backticks and cell addresses out of prose", () => {
    expect(richText("In B6, add `=A1+A2` to B10.")).toEqual([
      { kind: "text", text: "In " },
      { kind: "cell", text: "B6" },
      { kind: "text", text: ", add " },
      { kind: "code", text: "=A1+A2" },
      { kind: "text", text: " to " },
      { kind: "cell", text: "B10" },
      { kind: "text", text: "." },
    ]);
  });

  it("keeps a range as one reference", () => {
    expect(richText("Finds it in A2:C4 and $B$2:B9.")).toEqual([
      { kind: "text", text: "Finds it in " },
      { kind: "cell", text: "A2:C4" },
      { kind: "text", text: " and " },
      { kind: "cell", text: "$B$2:B9" },
      { kind: "text", text: "." },
    ]);
  });

  it("leaves words with digits, codes and function names alone", () => {
    expect(richText("Codes such as P-104, INV-2 and XLOOKUP or LOG10 stay text.")).toEqual([
      { kind: "text", text: "Codes such as P-104, INV-2 and XLOOKUP or LOG10 stay text." },
    ]);
  });

  it("returns nothing for empty text", () => {
    expect(richText("")).toEqual([]);
  });
});

describe("describeCells", () => {
  it("joins cells into column runs", () => {
    expect(describeCells(["B2", "B3", "B4", "D7"])).toBe("B2:B4 and D7");
    expect(describeCells(["A2", "B2"])).toBe("A2 and B2");
    expect(describeCells(["C5", "C3", "C4", "A1"])).toBe("A1 and C3:C5");
    expect(describeCells(["A1", "A3", "B1"])).toBe("A1, A3 and B1");
  });
});
