import { describe, expect, it } from "vitest";
import { type Node, parse } from "./parse.ts";

const ast = (formula: string): Node => {
  const r = parse(formula);
  if (!r.ok) throw new Error(`unexpected error: ${r.error.message}`);
  return r.ast;
};
/** A compact Lisp-like view of the tree, to check structure. */
const show = (n: Node): string => {
  switch (n.type) {
    case "number":
      return String(n.value);
    case "string":
      return JSON.stringify(n.value);
    case "bool":
      return n.value ? "TRUE" : "FALSE";
    case "error":
      return n.code;
    case "ref":
      return n.text.toUpperCase();
    case "range":
      return `[${n.text.toUpperCase()}]`;
    case "name":
      return `name:${n.name}`;
    case "empty":
      return "_";
    case "call":
      return `${n.name}(${n.args.map(show).join(" ")})`;
    case "unary":
      return `(${n.op} ${show(n.operand)})`;
    case "percent":
      return `(% ${show(n.operand)})`;
    case "binary":
      return `(${n.op} ${show(n.left)} ${show(n.right)})`;
  }
};
const err = (formula: string) => {
  const r = parse(formula);
  if (r.ok) throw new Error("expected an error");
  return r.error;
};

describe("parse: precedence", () => {
  it.each([
    ["=1+2*3", "(+ 1 (* 2 3))"],
    ["=(1+2)*3", "(* (+ 1 2) 3)"],
    ["=-2^2", "(^ (- 2) 2)"],
    ["=2^3^2", "(^ (^ 2 3) 2)"],
    ["=1-2-3", "(- (- 1 2) 3)"],
    ["=50%*2", "(* (% 50) 2)"],
    ["=-50%", "(% (- 50))"],
    ['=A1&"x"&1+2', '(& (& A1 "x") (+ 1 2))'],
    ["=A1+1>B1*2", "(> (+ A1 1) (* B1 2))"],
    ["=A1=B1", "(= A1 B1)"],
    ["=--A1", "(- (- A1))"],
  ])("%s", (formula, expected) => {
    expect(show(ast(formula))).toBe(expected);
  });
});

describe("parse: references and calls", () => {
  it("builds ranges from two cells, whole columns and whole rows", () => {
    expect(show(ast("=SUM(B2:B5,$C:$C,3:3)"))).toBe("SUM([B2:B5] [$C:$C] [3:3])");
  });

  it("keeps function names in upper case and allows empty arguments", () => {
    expect(show(ast("=if(A1,,1)"))).toBe("IF(A1 _ 1)");
    expect(show(ast("=TODAY()"))).toBe("TODAY()");
    expect(show(ast("=IF(A1,1,)"))).toBe("IF(A1 1 _)");
  });

  it("nests calls", () => {
    expect(show(ast('=ROUND(AVERAGE(B2:B5),1)&" kg"'))).toBe('(& ROUND(AVERAGE([B2:B5]) 1) " kg")');
  });

  it("keeps bare names for the grader to report", () => {
    expect(show(ast("=total*2"))).toBe("(* name:total 2)");
  });

  it("records start and end on every node", () => {
    const n = ast("=SUM(B2:B5)+1");
    expect(n).toMatchObject({ type: "binary", start: 1, end: 13 });
    if (n.type !== "binary" || n.left.type !== "call") throw new Error("shape");
    expect(n.left).toMatchObject({ start: 1, end: 11, nameStart: 1, nameEnd: 4 });
    expect(n.left.args[0]).toMatchObject({ type: "range", start: 5, end: 10, text: "B2:B5" });
    expect(n.right).toMatchObject({ type: "number", start: 12, end: 13 });
  });

  it("parses literals", () => {
    expect(ast('="a"')).toMatchObject({ type: "string", value: "a" });
    expect(ast("=TRUE")).toMatchObject({ type: "bool", value: true });
    expect(ast("=#N/A")).toMatchObject({ type: "error", code: "#N/A" });
    expect(ast("=1e3")).toMatchObject({ type: "number", value: 1000 });
  });
});

describe("parse: errors", () => {
  it.each([
    ["=SUM(B2:B5", "Add ) to close SUM(.", 4, 5],
    ["=(B2+1", "A closing bracket ) is missing.", 1, 2],
    ["=SUM(B2:B5))", "There is one ) too many.", 11, 12],
    ["=B2+", "The formula ends after +, so a value is missing.", 3, 4],
    ["=B2 B3", "Add an operator such as + between B2 and B3.", 4, 6],
    ["=1,2", "Commas only separate arguments inside a function.", 2, 3],
    ["=()", "The brackets are empty.", 1, 3],
    ["=B2:", "Write a range as two cells with a colon between them, such as B2:B5.", 3, 4],
    ["=*B2", "The formula cannot start with *.", 1, 2],
    ["=SUM", "SUM needs brackets, such as SUM(B2:B5).", 1, 4],
    ["=SUM(B2:B5 B6)", "Add an operator such as + between B2:B5 and B6.", 11, 13],
  ])("%s", (formula, message, start, end) => {
    expect(err(formula)).toEqual({ message, start, end });
  });

  it("passes tokenizer errors through", () => {
    expect(err("SUM(B2)").message).toBe("Start the formula with =.");
  });
});
