// Why this exists: the text functions. Positions count from 1, as in Excel;
// FIND matches case, SEARCH ignores it and accepts wildcards.
import { isError } from "../errors.ts";
import { type FunctionSpec, isRange, parseNumericText, toText } from "../values.ts";
import { wildcardRegExp } from "./criteria.ts";
import { formatCode } from "./format-code.ts";
import { bool, cells, ExcelError, fail, fn, num, safe, scalar, text } from "./helpers.ts";

/** Every value of every argument as text, ranges row by row. */
function texts(args: Parameters<FunctionSpec["run"]>[0], skipEmpty: boolean): string[] {
  const out: string[] = [];
  for (const a of args) {
    if (a.empty) continue;
    const v = a.get();
    for (const c of isRange(v) ? cells(v) : [v]) {
      const t = toText(c);
      if (isError(t)) throw new ExcelError(t);
      if (!(skipEmpty && t === "")) out.push(t);
    }
  }
  return out;
}

const count = (arg: Parameters<typeof num>[0], fallback: number) => {
  const n = Math.trunc(num(arg, fallback));
  return n < 0 ? fail("#VALUE!") : n;
};

function position(args: Parameters<FunctionSpec["run"]>[0], ignoreCase: boolean): number {
  const find = text(args[0]);
  const within = text(args[1]);
  const start = Math.trunc(num(args[2], 1));
  if (start < 1 || start > within.length + 1) return fail("#VALUE!");
  const hay = within.slice(start - 1);
  let at: number;
  if (ignoreCase) {
    const re = new RegExp(wildcardRegExp(find).source.replace(/^\^|\$$/gu, ""), "iu");
    at = hay.search(re);
  } else at = hay.indexOf(find);
  return at < 0 ? fail("#VALUE!") : at + start;
}

/**
 * TEXTBEFORE and TEXTAFTER: the text on one side of a delimiter. The instance
 * picks which delimiter, counting from the end when it is negative. With no
 * such delimiter the answer is the if_not_found argument, or #N/A.
 */
function split(args: Parameters<FunctionSpec["run"]>[0], side: "before" | "after") {
  const whole = text(args[0]);
  const delimiter = text(args[1]);
  const instance = Math.trunc(num(args[2], 1));
  const ignoreCase = num(args[3], 0) === 1;
  if (instance === 0) return fail("#VALUE!");
  if (delimiter === "") return side === "before" ? "" : whole;
  const hay = ignoreCase ? whole.toLowerCase() : whole;
  const needle = ignoreCase ? delimiter.toLowerCase() : delimiter;
  const at: number[] = [];
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) at.push(i);
  const pick = at[instance > 0 ? instance - 1 : at.length + instance];
  if (pick === undefined) return args[5] && !args[5].empty ? text(args[5]) : fail("#N/A");
  return side === "before" ? whole.slice(0, pick) : whole.slice(pick + delimiter.length);
}

export const TEXT: Record<string, FunctionSpec> = {
  TEXT: fn(
    2,
    2,
    safe((args) => {
      const v = scalar(args[0]) as string | number | boolean | null;
      const out = formatCode(v, text(args[1]));
      return out === null ? fail("#VALUE!") : out.text;
    }),
  ),
  LEFT: fn(
    1,
    2,
    safe((args) => text(args[0]).slice(0, count(args[1], 1))),
  ),
  RIGHT: fn(
    1,
    2,
    safe((args) => {
      const t = text(args[0]);
      const n = count(args[1], 1);
      return n === 0 ? "" : t.slice(-n);
    }),
  ),
  MID: fn(
    3,
    3,
    safe((args) => {
      const t = text(args[0]);
      const start = Math.trunc(num(args[1]));
      if (start < 1) return fail("#VALUE!");
      return t.slice(start - 1, start - 1 + count(args[2], 0));
    }),
  ),
  LEN: fn(
    1,
    1,
    safe((args) => text(args[0]).length),
  ),
  UPPER: fn(
    1,
    1,
    safe((args) => text(args[0]).toUpperCase()),
  ),
  LOWER: fn(
    1,
    1,
    safe((args) => text(args[0]).toLowerCase()),
  ),
  PROPER: fn(
    1,
    1,
    safe((args) =>
      text(args[0])
        .toLowerCase()
        .replace(
          /(^|[^\p{L}])(\p{L})/gu,
          (_, before: string, letter: string) => before + letter.toUpperCase(),
        ),
    ),
  ),
  TRIM: fn(
    1,
    1,
    safe((args) => text(args[0]).replace(/ +/gu, " ").trim()),
  ),
  CONCAT: fn(
    1,
    255,
    safe((args) => texts(args, false).join("")),
  ),
  CONCATENATE: fn(
    1,
    255,
    safe((args) => {
      if (args.some((a) => !a.empty && isRange(a.get()) && cells(a.get() as never).length > 1))
        return fail("#VALUE!");
      return texts(args, false).join("");
    }),
  ),
  TEXTJOIN: fn(
    3,
    255,
    safe((args) => texts(args.slice(2), bool(args[1], true)).join(text(args[0]))),
  ),
  VALUE: fn(
    1,
    1,
    safe((args) => {
      const t = text(args[0]);
      return parseNumericText(t) ?? fail("#VALUE!");
    }),
  ),
  EXACT: fn(
    2,
    2,
    safe((args) => text(args[0]) === text(args[1])),
  ),
  SUBSTITUTE: fn(
    3,
    4,
    safe((args) => {
      const t = text(args[0]);
      const from = text(args[1]);
      const to = text(args[2]);
      if (from === "") return t;
      if (!args[3]) return t.split(from).join(to);
      const nth = Math.trunc(num(args[3]));
      if (nth < 1) return fail("#VALUE!");
      let at = -1;
      for (let i = 0; i < nth; i++) {
        at = t.indexOf(from, at + 1);
        if (at < 0) return t;
      }
      return t.slice(0, at) + to + t.slice(at + from.length);
    }),
  ),
  FIND: fn(
    2,
    3,
    safe((args) => position(args, false)),
  ),
  SEARCH: fn(
    2,
    3,
    safe((args) => position(args, true)),
  ),
  TEXTBEFORE: fn(
    2,
    6,
    safe((args) => split(args, "before")),
  ),
  TEXTAFTER: fn(
    2,
    6,
    safe((args) => split(args, "after")),
  ),
  REPLACE: fn(
    4,
    4,
    safe((args) => {
      const old = text(args[0]);
      const start = Math.trunc(num(args[1]));
      if (start < 1) return fail("#VALUE!");
      const length = count(args[2], 0);
      return old.slice(0, start - 1) + text(args[3]) + old.slice(start - 1 + length);
    }),
  ),
};
