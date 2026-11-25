import { describe, expect, it } from "vitest";
import { syntaxHtml, syntaxParts } from "./syntax.ts";

describe("syntaxParts", () => {
  it("marks bracketed arguments and the ellipsis as optional", () => {
    expect(syntaxParts("=SUM(number1, [number2], ...)")).toEqual({
      name: "SUM",
      args: [
        { text: "number1", optional: false },
        { text: "[number2]", optional: true },
        { text: "...", optional: true },
      ],
    });
  });
  it("keeps a bracketed pair with a comma as one optional argument", () => {
    const { args } = syntaxParts("=IFS(test1, value1, [test2, value2], ...)");
    expect(args.map((a) => a.text)).toEqual(["test1", "value1", "[test2, value2]", "..."]);
  });
  it("accepts a line without the leading equals sign", () => {
    expect(syntaxParts("VLOOKUP(a, b, c, [d])").name).toBe("VLOOKUP");
  });
  it("renders HTML with no stray spaces", () => {
    expect(syntaxHtml("=IF(a, [b])")).toBe(
      '<b>=IF</b>(<span class="r">a</span>, <span class="o">[b]</span>)',
    );
  });
});
