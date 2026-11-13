// Why this exists: splits a formula into tokens and records where each one
// sits in the text, so later steps can point at exact characters. It also
// turns the commonest typing mistakes into plain explanations.
import { parseAddress } from "./address.ts";

export type TokenKind =
  | "number"
  | "string"
  | "bool"
  | "error"
  | "ref"
  | "columns"
  | "rows"
  | "name"
  | "op"
  | "lparen"
  | "rparen"
  | "comma"
  | "colon";

export interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
  /** The text inside the quotes, for strings. */
  value?: string;
}

export interface SyntaxProblem {
  message: string;
  start: number;
  end: number;
}

export type TokenizeResult = { ok: true; tokens: Token[] } | { ok: false; error: SyntaxProblem };

const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/u;
const ERROR = /^#(?:DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!)/iu;
const COLUMNS = /^\$?[A-Za-z]{1,3}:\$?[A-Za-z]{1,3}(?![A-Za-z0-9_.(])/u;
const ROWS = /^\$?\d+:\$?\d+(?![A-Za-z0-9_.])/u;
const REF = /^\$?[A-Za-z]{1,3}\$?\d+(?![A-Za-z0-9_.(])/u;
const NAME = /^[A-Za-z_][A-Za-z0-9_.]*/u;
const OPS = ["<=", ">=", "<>", "+", "-", "*", "/", "^", "&", "=", "<", ">", "%"];
const CURLY = /[‘’“”]/u;

const fail = (message: string, start: number, end = start + 1): TokenizeResult => ({
  ok: false,
  error: { message, start, end },
});

export function tokenize(formula: string): TokenizeResult {
  if (!formula.startsWith("=")) return fail("Start the formula with =.", 0);
  if (formula.slice(1).trim() === "")
    return fail("The formula is empty after =.", 0, formula.length);

  const tokens: Token[] = [];
  let i = 1;
  const push = (kind: TokenKind, text: string, extra: Partial<Token> = {}) => {
    tokens.push({ kind, text, start: i, end: i + text.length, ...extra });
    i += text.length;
  };

  while (i < formula.length) {
    const rest = formula.slice(i);
    const ch = rest[0] as string;
    if (/\s/u.test(ch)) {
      i++;
      continue;
    }
    if (CURLY.test(ch))
      return fail("Use straight quotes in formulas. Your keyboard typed curly ones.", i);
    if (ch === ";") return fail("Use commas between arguments, not semicolons.", i);
    if (ch === '"') {
      let j = i + 1;
      let value = "";
      for (;;) {
        if (j >= formula.length) return fail("Text needs a closing quote mark.", i, formula.length);
        if (formula[j] === '"') {
          if (formula[j + 1] === '"') {
            value += '"';
            j += 2;
            continue;
          }
          break;
        }
        value += formula[j];
        j++;
      }
      push("string", formula.slice(i, j + 1), { value });
      continue;
    }
    if (ch === "#") {
      const m = ERROR.exec(rest);
      if (!m) return fail("The character # cannot be used here.", i);
      push("error", m[0]);
      continue;
    }
    if (ch === "(") {
      push("lparen", ch);
      continue;
    }
    if (ch === ")") {
      push("rparen", ch);
      continue;
    }
    if (ch === ",") {
      push("comma", ch);
      continue;
    }
    const rows = ROWS.exec(rest);
    if (rows) {
      push("rows", rows[0]);
      continue;
    }
    const num = NUMBER.exec(rest);
    if (num) {
      push("number", num[0]);
      continue;
    }
    const cols = COLUMNS.exec(rest);
    if (cols) {
      push("columns", cols[0]);
      continue;
    }
    const ref = REF.exec(rest);
    if (ref && parseAddress(ref[0])) {
      push("ref", ref[0]);
      continue;
    }
    const name = NAME.exec(rest);
    if (name) {
      const after = formula.slice(i + name[0].length);
      if (after.startsWith("!"))
        return fail(
          "This exercise uses one sheet, so leave out sheet names.",
          i,
          i + name[0].length + 1,
        );
      const called = /^\s*\(/u.test(after);
      if (!called && /^(TRUE|FALSE)$/iu.test(name[0])) push("bool", name[0]);
      else push("name", name[0]);
      continue;
    }
    if (ch === ":") {
      push("colon", ch);
      continue;
    }
    const op = OPS.find((o) => rest.startsWith(o));
    if (op) {
      push("op", op);
      continue;
    }
    if (ch === "!") return fail("This exercise uses one sheet, so leave out sheet names.", i);
    return fail(`The character ${ch} cannot be used here.`, i);
  }
  return { ok: true, tokens };
}
