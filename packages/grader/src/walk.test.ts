import { describe, expect, it } from "vitest";
import { type Node, parse } from "./parse.ts";
import { walkAst } from "./walk.ts";

const tree = (f: string): Node => {
  const r = parse(f);
  if (!r.ok) throw new Error(r.error.message);
  return r.ast;
};

describe("walkAst", () => {
  it("visits every node depth first, parents before children, with each parent", () => {
    const seen: string[] = [];
    walkAst(tree("=SUM(B2:B5)*-A1"), (node, parent) => {
      seen.push(`${node.type}<${parent?.type ?? "root"}`);
    });
    expect(seen).toEqual(["binary<root", "call<binary", "range<call", "unary<binary", "ref<unary"]);
  });

  it("visits empty arguments and percent nodes", () => {
    const types: string[] = [];
    walkAst(tree("=IF(A1,,5%)"), (n) => {
      types.push(n.type);
    });
    expect(types).toEqual(["call", "ref", "empty", "percent", "number"]);
  });
});
