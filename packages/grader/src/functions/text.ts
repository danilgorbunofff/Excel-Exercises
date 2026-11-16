// Why this exists: the text functions. Positions count from 1, as in Excel;
// FIND matches case, SEARCH ignores it and accepts wildcards.
import { isError } from "../errors.ts";
import { type FunctionSpec, isRange, parseNumericText, toText } from "../values.ts";
import { wildcardRegExp } from "./criteria.ts";
import { dateFromSerial } from "./date.ts";
import { bool, cells, ExcelError, fail, fn, num, roundTo, safe, scalar, text } from "./helpers.ts";

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

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A date or time format code such as dd/mm/yyyy, mmm or hh:mm, en-US. */
function formatDate(serial: number, code: string): string | null {
  if (serial < 0) return null;
  const { year, month, day } = dateFromSerial(Math.floor(serial));
  const secs = Math.round((serial - Math.floor(serial)) * 86400);
  const hour = Math.floor(secs / 3600);
  const minute = Math.floor(secs / 60) % 60;
  const second = secs % 60;
  const ampm = /AM\/PM/iu.test(code);
  // Excel counts 1900-01-01 as a Sunday, so the weekday is (serial - 1) mod 7 from Sunday.
  const weekday = (((Math.floor(serial) - 1) % 7) + 7) % 7;
  const two = (n: number) => String(n).padStart(2, "0");
  let out = "";
  let afterHour = false;
  const re = /"([^"]*)"|\\(.)|(yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM)|(.)/giu;
  for (const m of code.matchAll(re)) {
    if (m[1] !== undefined) out += m[1];
    else if (m[2] !== undefined) out += m[2];
    else if (m[4] !== undefined) out += m[4];
    else {
      const t = (m[3] as string).toLowerCase();
      if (t === "yyyy") out += String(year);
      else if (t === "yy") out += two(year % 100);
      else if (t === "mmmm") out += MONTHS[month - 1];
      else if (t === "mmm") out += MONTHS[month - 1]?.slice(0, 3);
      else if (t === "mm" || t === "m") {
        const v = afterHour ? minute : month;
        out += t === "mm" ? two(v) : String(v);
      } else if (t === "dddd") out += DAYS[weekday];
      else if (t === "ddd") out += DAYS[weekday]?.slice(0, 3);
      else if (t === "dd") out += two(day);
      else if (t === "d") out += String(day);
      else if (t === "hh" || t === "h") {
        const h = ampm ? ((hour + 11) % 12) + 1 : hour;
        out += t === "hh" ? two(h) : String(h);
        afterHour = true;
        continue;
      } else if (t === "ss" || t === "s") out += t === "ss" ? two(second) : String(second);
      else if (t === "am/pm") out += hour < 12 ? "AM" : "PM";
      // m right after an hour is minutes; literals such as ":" in between do not break that.
      afterHour = false;
    }
  }
  return out;
}

/** A number format code such as 0.00, #,##0, 0%, $#,##0.00 or "x"0, en-US. */
function formatNumberCode(n: number, code: string): string | null {
  const sections = code.split(";");
  let section = sections[0] ?? "";
  let sign = n < 0 ? "-" : "";
  if (n < 0 && sections.length > 1) {
    section = sections[1] ?? "";
    sign = "";
  } else if (n === 0 && sections.length > 2) section = sections[2] ?? "";
  // Literal text: quoted, escaped, or plain characters around the number.
  const plain = section.replace(/"[^"]*"|\\./gu, "");
  if (/[eE][+-]|\?|\//u.test(plain)) return null;
  const percent = plain.includes("%");
  let value = Math.abs(n) * (percent ? 100 : 1);
  const first = plain.search(/[0#]/u);
  if (first < 0) return section.replace(/"([^"]*)"|\\(.)/gu, "$1$2");
  const core = /[0#,.]+/u.exec(plain.slice(first))?.[0] ?? "";
  const [intPart = "", decPart = ""] = core.split(".");
  const decimals = decPart.replace(/[^0#]/gu, "").length;
  const required = (decPart.match(/0/gu) ?? []).length;
  const grouped = intPart.includes(",") && /[0#],[0#]/u.test(intPart);
  // A trailing comma divides by 1000 per comma.
  for (const _ of intPart.match(/,+$/u)?.[0] ?? "") value /= 1000;
  const minInt = (intPart.match(/0/gu) ?? []).length;
  const rounded = roundTo(value, decimals, "half");
  let [i = "0", d = ""] = rounded.toFixed(decimals).split(".");
  if (i === "0" && minInt === 0) i = "";
  i = i.padStart(minInt, "0");
  if (grouped) i = i.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  while (d.length > required && d.endsWith("0")) d = d.slice(0, -1);
  // Excel keeps the point even when optional decimals are all dropped: TEXT(5,"0.##") is "5.".
  const number = decimals ? `${i}.${d}` : i;
  // Put the number where the placeholders were, keeping the text around them.
  const start = section.search(/[0#]/u);
  let end = start;
  while (end < section.length && /[0#,.]/u.test(section[end] as string)) end++;
  const around = (t: string) => t.replace(/"([^"]*)"|\\(.)/gu, "$1$2");
  return `${sign}${around(section.slice(0, start))}${number}${around(section.slice(end))}`;
}

/** TEXT: the value shown with a format code. Null for a code this sheet cannot show. */
function formatText(v: string | number | boolean | null, code: string): string | null {
  if (code === "@" || /^general$/iu.test(code)) return toText(v) as string;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  const n = typeof v === "number" ? v : v === null ? 0 : parseNumericText(v);
  if (n === null) return v as string;
  const bare = code.replace(/"[^"]*"|\\./gu, "");
  if (/[ydhs]/iu.test(bare) || /^m+$/iu.test(bare) || /mmm/iu.test(bare))
    return formatDate(n, code);
  return formatNumberCode(n, code);
}

export const TEXT: Record<string, FunctionSpec> = {
  TEXT: fn(
    2,
    2,
    safe((args) => {
      const v = scalar(args[0]) as string | number | boolean | null;
      const out = formatText(v, text(args[1]));
      return out === null ? fail("#VALUE!") : out;
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
