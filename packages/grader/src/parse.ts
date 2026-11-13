// Why this exists: turns tokens into a tree that follows Excel's operator
// precedence. Every node keeps its start and end in the formula text, so the
// interface can mark exactly what a formula reads.
import { type CellAddress, columnIndex, parseAddress } from "./address.ts";
import type { ErrorCode } from "./errors.ts";
import { isKnownFunction } from "./functions/registry.ts";
import { type SyntaxProblem, type Token, tokenize } from "./tokenize.ts";

interface Span {
  start: number;
  end: number;
}

/** One end of a range. A null column or row means a whole row or column. */
export interface Bound {
  col: number | null;
  row: number | null;
  absCol: boolean;
  absRow: boolean;
}

export type Node =
  | (Span & { type: "number"; value: number })
  | (Span & { type: "string"; value: string })
  | (Span & { type: "bool"; value: boolean })
  | (Span & { type: "error"; code: ErrorCode })
  | (Span & { type: "ref"; text: string; address: CellAddress })
  | (Span & { type: "range"; text: string; first: Bound; last: Bound })
  | (Span & { type: "name"; name: string })
  | (Span & { type: "empty" })
  | (Span & { type: "call"; name: string; nameStart: number; nameEnd: number; args: Node[] })
  | (Span & { type: "unary"; op: "-" | "+"; operand: Node })
  | (Span & { type: "percent"; operand: Node })
  | (Span & { type: "binary"; op: BinaryOp; left: Node; right: Node });

export type BinaryOp = "+" | "-" | "*" | "/" | "^" | "&" | "=" | "<>" | "<" | ">" | "<=" | ">=";

export type ParseResult = { ok: true; ast: Node } | { ok: false; error: SyntaxProblem };

const INFIX: Record<string, [number, number]> = {
  "=": [10, 11],
  "<>": [10, 11],
  "<": [10, 11],
  ">": [10, 11],
  "<=": [10, 11],
  ">=": [10, 11],
  "&": [20, 21],
  "+": [30, 31],
  "-": [30, 31],
  "*": [40, 41],
  "/": [40, 41],
  "^": [50, 51],
};
const PERCENT_BP = 55;
const PREFIX_BP = 60;

class ParseFailure extends Error {
  readonly problem: SyntaxProblem;
  constructor(problem: SyntaxProblem) {
    super(problem.message);
    this.problem = problem;
  }
}

const cellBound = (a: CellAddress): Bound => ({
  col: a.col,
  row: a.row,
  absCol: a.absCol,
  absRow: a.absRow,
});

function lineBound(part: string, kind: "columns" | "rows"): Bound {
  const abs = part.startsWith("$");
  const v = part.replace("$", "");
  return kind === "columns"
    ? { col: columnIndex(v), row: null, absCol: abs, absRow: false }
    : { col: null, row: Number(v), absCol: false, absRow: abs };
}

export function parse(formula: string): ParseResult {
  const t = tokenize(formula);
  if (!t.ok) return t;
  const tokens = t.tokens;
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const fail = (message: string, span: Span): never => {
    throw new ParseFailure({ message, start: span.start, end: span.end });
  };
  const describe = (n: Node): string => formula.slice(n.start, n.end);

  function parseExpr(minBp: number, closer?: Token): Node {
    let left = parsePrefix(closer);
    for (;;) {
      const tok = peek();
      if (!tok) break;
      if (tok.kind === "op" && tok.text === "%") {
        if (PERCENT_BP < minBp) break;
        pos++;
        left = { type: "percent", operand: left, start: left.start, end: tok.end };
        continue;
      }
      if (tok.kind === "op") {
        const bp = INFIX[tok.text] as [number, number];
        if (bp[0] < minBp) break;
        pos++;
        if (!peek()) fail(`The formula ends after ${tok.text}, so a value is missing.`, tok);
        const right = parseExpr(bp[1], closer);
        left = {
          type: "binary",
          op: tok.text as BinaryOp,
          left,
          right,
          start: left.start,
          end: right.end,
        };
        continue;
      }
      if (tok.kind === "rparen" || tok.kind === "comma") break;
      if (tok.kind === "colon")
        fail("Write a range as two cells with a colon between them, such as B2:B5.", tok);
      const next = parsePrefix(closer);
      fail(`Add an operator such as + between ${describe(left)} and ${describe(next)}.`, next);
    }
    return left;
  }

  function parsePrefix(closer?: Token): Node {
    const tok = peek();
    if (!tok) {
      if (closer)
        fail(
          closer.text === "("
            ? "A closing bracket ) is missing."
            : `Add ) to close ${closer.text}.`,
          closer,
        );
      return fail("The formula ends too early.", {
        start: formula.length - 1,
        end: formula.length,
      });
    }
    pos++;
    switch (tok.kind) {
      case "number":
        return { type: "number", value: Number(tok.text), start: tok.start, end: tok.end };
      case "string":
        return { type: "string", value: tok.value ?? "", start: tok.start, end: tok.end };
      case "bool":
        return {
          type: "bool",
          value: tok.text.toUpperCase() === "TRUE",
          start: tok.start,
          end: tok.end,
        };
      case "error":
        return {
          type: "error",
          code: tok.text.toUpperCase() as ErrorCode,
          start: tok.start,
          end: tok.end,
        };
      case "columns":
      case "rows": {
        const [a, b] = tok.text.split(":") as [string, string];
        return {
          type: "range",
          text: tok.text,
          first: lineBound(a, tok.kind),
          last: lineBound(b, tok.kind),
          start: tok.start,
          end: tok.end,
        };
      }
      case "ref": {
        const address = parseAddress(tok.text) as CellAddress;
        const colon = peek();
        if (colon?.kind !== "colon")
          return { type: "ref", text: tok.text, address, start: tok.start, end: tok.end };
        pos++;
        const other = peek();
        if (other?.kind !== "ref")
          return fail(
            "Write a range as two cells with a colon between them, such as B2:B5.",
            colon,
          );
        pos++;
        const last = parseAddress(other.text) as CellAddress;
        return {
          type: "range",
          text: formula.slice(tok.start, other.end),
          first: cellBound(address),
          last: cellBound(last),
          start: tok.start,
          end: other.end,
        };
      }
      case "name": {
        const open = peek();
        if (open?.kind !== "lparen") {
          if (isKnownFunction(tok.text))
            fail(
              `${tok.text.toUpperCase()} needs brackets, such as ${tok.text.toUpperCase()}(B2:B5).`,
              tok,
            );
          return { type: "name", name: tok.text, start: tok.start, end: tok.end };
        }
        pos++;
        const opening: Token = { ...open, text: `${tok.text.toUpperCase()}(` };
        const args: Node[] = [];
        if (peek()?.kind === "rparen") {
          const close = peek() as Token;
          pos++;
          return {
            type: "call",
            name: tok.text.toUpperCase(),
            nameStart: tok.start,
            nameEnd: tok.end,
            args,
            start: tok.start,
            end: close.end,
          };
        }
        for (;;) {
          const here = peek();
          if (here?.kind === "comma" || here?.kind === "rparen") {
            args.push({ type: "empty", start: here.start, end: here.start });
          } else {
            args.push(parseExpr(0, opening));
          }
          const sep = peek();
          if (!sep) fail(`Add ) to close ${tok.text.toUpperCase()}(.`, opening);
          pos++;
          if (sep?.kind === "rparen") {
            return {
              type: "call",
              name: tok.text.toUpperCase(),
              nameStart: tok.start,
              nameEnd: tok.end,
              args,
              start: tok.start,
              end: sep.end,
            };
          }
          if (sep?.kind !== "comma") fail(`Add ) to close ${tok.text.toUpperCase()}(.`, opening);
        }
      }
      case "lparen": {
        if (peek()?.kind === "rparen")
          fail("The brackets are empty.", { start: tok.start, end: (peek() as Token).end });
        const inner = parseExpr(0, tok);
        const close = peek();
        if (close?.kind !== "rparen") fail("A closing bracket ) is missing.", tok);
        pos++;
        // Cells and ranges keep their own span, so a highlight never includes a bracket.
        if (inner.type === "ref" || inner.type === "range") return inner;
        return { ...inner, start: tok.start, end: (close as Token).end } as Node;
      }
      case "op":
        if (tok.text === "-" || tok.text === "+") {
          if (!peek()) fail(`The formula ends after ${tok.text}, so a value is missing.`, tok);
          const operand = parseExpr(PREFIX_BP, closer);
          return { type: "unary", op: tok.text, operand, start: tok.start, end: operand.end };
        }
        return fail(
          pos === 1
            ? `The formula cannot start with ${tok.text}.`
            : `Something is missing before ${tok.text}.`,
          tok,
        );
      case "rparen":
        return fail(closer ? "Something is missing before )." : "There is one ) too many.", tok);
      case "comma":
        return fail(
          closer
            ? "An argument is missing before the comma."
            : "Commas only separate arguments inside a function.",
          tok,
        );
      case "colon":
        return fail("Write a range as two cells with a colon between them, such as B2:B5.", tok);
    }
  }

  try {
    const ast = parseExpr(0);
    const extra = peek();
    if (extra) {
      if (extra.kind === "rparen") fail("There is one ) too many.", extra);
      if (extra.kind === "comma") fail("Commas only separate arguments inside a function.", extra);
      fail(`Something unexpected follows ${describe(ast)}.`, extra);
    }
    return { ok: true, ast };
  } catch (e) {
    if (e instanceof ParseFailure) return { ok: false, error: e.problem };
    throw e;
  }
}
