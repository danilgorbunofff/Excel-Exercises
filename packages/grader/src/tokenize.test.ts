import { describe, expect, it } from "vitest";
import { type Token, tokenize } from "./tokenize.ts";

const ok = (formula: string): Token[] => {
  const r = tokenize(formula);
  if (!r.ok) throw new Error(`unexpected error: ${r.error.message}`);
  return r.tokens;
};
const kinds = (formula: string) => ok(formula).map((t) => `${t.kind}:${t.text}`);
const err = (formula: string) => {
  const r = tokenize(formula);
  if (r.ok) throw new Error("expected an error");
  return r.error;
};

describe("tokenize", () => {
  it("records each token with its position in the original text", () => {
    expect(ok("=SUM(B2:B5)")).toEqual([
      { kind: "name", text: "SUM", start: 1, end: 4 },
      { kind: "lparen", text: "(", start: 4, end: 5 },
      { kind: "ref", text: "B2", start: 5, end: 7 },
      { kind: "colon", text: ":", start: 7, end: 8 },
      { kind: "ref", text: "B5", start: 8, end: 10 },
      { kind: "rparen", text: ")", start: 10, end: 11 },
    ]);
  });

  it("skips spaces but keeps positions", () => {
    expect(ok("= B2 +  1").map((t) => [t.text, t.start])).toEqual([
      ["B2", 2],
      ["+", 5],
      ["1", 8],
    ]);
  });

  it("reads numbers in every form Excel accepts", () => {
    expect(kinds("=1+1.5+.5+1e3+2E-2")).toEqual([
      "number:1",
      "op:+",
      "number:1.5",
      "op:+",
      "number:.5",
      "op:+",
      "number:1e3",
      "op:+",
      "number:2E-2",
    ]);
  });

  it("reads strings with doubled quotes inside", () => {
    expect(ok('="say ""hi"""')[0]).toMatchObject({
      kind: "string",
      text: '"say ""hi"""',
      value: 'say "hi"',
    });
  });

  it("reads absolute and mixed references, and lower case", () => {
    expect(kinds("=$B$2+B$3+$c4")).toEqual(["ref:$B$2", "op:+", "ref:B$3", "op:+", "ref:$c4"]);
  });

  it("reads whole-column and whole-row ranges", () => {
    expect(kinds("=SUM(B:B)+SUM($2:$3)")).toEqual([
      "name:SUM",
      "lparen:(",
      "columns:B:B",
      "rparen:)",
      "op:+",
      "name:SUM",
      "lparen:(",
      "rows:$2:$3",
      "rparen:)",
    ]);
  });

  it("tells a function name from a cell address by the bracket after it", () => {
    expect(kinds("=LOG10(A1)")[0]).toBe("name:LOG10");
    expect(kinds("=AB12")[0]).toBe("ref:AB12");
  });

  it("reads TRUE and FALSE as logicals, and as names when called", () => {
    expect(kinds("=TRUE")).toEqual(["bool:TRUE"]);
    expect(kinds("=false")).toEqual(["bool:false"]);
    expect(kinds("=TRUE()")[0]).toBe("name:TRUE");
  });

  it("reads error values", () => {
    expect(kinds("=#N/A")).toEqual(["error:#N/A"]);
    expect(kinds("=IFERROR(#div/0!,1)")[2]).toBe("error:#div/0!");
  });

  it("reads two-character operators before one-character ones", () => {
    expect(kinds("=A1<=1")).toEqual(["ref:A1", "op:<=", "number:1"]);
    expect(kinds("=A1<>1")).toEqual(["ref:A1", "op:<>", "number:1"]);
    expect(kinds("=50%")).toEqual(["number:50", "op:%"]);
  });

  it("reads other names, so the parser can report unknown ones", () => {
    expect(kinds("=total")).toEqual(["name:total"]);
    expect(kinds("=STDEV.S(A1:A3)")[0]).toBe("name:STDEV.S");
  });
});

describe("tokenize errors", () => {
  it("requires a leading =", () => {
    expect(err("SUM(B2:B5)")).toMatchObject({
      message: "Start the formula with =.",
      start: 0,
      end: 1,
    });
  });

  it("rejects an empty formula", () => {
    expect(err("=").message).toBe("The formula is empty after =.");
    expect(err("=   ").message).toBe("The formula is empty after =.");
  });

  it("explains curly quotes, which phone keyboards often type", () => {
    expect(err("=“West”")).toMatchObject({
      message: "Use straight quotes in formulas. Your keyboard typed curly ones.",
      start: 1,
    });
  });

  it("explains semicolons used as separators", () => {
    expect(err("=SUM(B2;B3)")).toMatchObject({
      message: "Use commas between arguments, not semicolons.",
      start: 7,
    });
  });

  it("explains sheet names", () => {
    expect(err("=Sheet1!A1").message).toBe(
      "This exercise uses one sheet, so leave out sheet names.",
    );
  });

  it("reports text without a closing quote", () => {
    expect(err('=IF(A1="West,1,0)')).toMatchObject({
      message: "Text needs a closing quote mark.",
      start: 7,
    });
  });

  it("reports characters that cannot appear in a formula", () => {
    expect(err("=A1@B1")).toMatchObject({
      message: "The character @ cannot be used here.",
      start: 3,
      end: 4,
    });
  });
});
