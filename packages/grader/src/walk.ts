// Why this exists: visits every node of a parsed formula. The interface uses
// it to find the cells and ranges a formula reads; the grader uses it to find
// the functions a formula calls.
import type { Node } from "./parse.ts";

export function walkAst(
  node: Node,
  visit: (node: Node, parent: Node | null) => void,
  parent: Node | null = null,
): void {
  visit(node, parent);
  switch (node.type) {
    case "call":
      for (const a of node.args) walkAst(a, visit, node);
      break;
    case "unary":
    case "percent":
      walkAst(node.operand, visit, node);
      break;
    case "binary":
      walkAst(node.left, visit, node);
      walkAst(node.right, visit, node);
      break;
    default:
      break;
  }
}
