// Why this exists: Excel number format codes, en-US, as TEXT() and the
// Number formats page show them. One code has up to four sections
// (positive;negative;zero;text), each with an optional colour and condition.
import { parseNumericText, toText } from "../values.ts";
import { dateFromSerial } from "./date.ts";
import { roundTo } from "./helpers.ts";

/** What a value looks like under a format code; color is the section's [Red] etc. */
export interface Formatted {
  text: string;
  color: string | null;
}

type Atom = { lit: string } | { br: string } | { ch: string };

interface Section {
  color: string | null;
  cond: { op: string; val: number } | null;
  atoms: Atom[];
}

const COLORS = ["black", "blue", "cyan", "green", "magenta", "red", "white", "yellow"];
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

/** Split on ; outside quotes, escapes and [brackets]. */
function splitSections(code: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  let bracket = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i] as string;
    if (quoted) {
      cur += c;
      if (c === '"') quoted = false;
      continue;
    }
    if (c === "\\" || c === "_" || c === "*") {
      cur += c + (code[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === "[") bracket = true;
    else if (c === "]") bracket = false;
    else if (c === ";" && !bracket) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

/** Quoted text, escapes, _x padding and *x fill become literals; [..] stays a bracket. */
function toAtoms(s: string): Atom[] {
  const out: Atom[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (c === '"') {
      const j = s.indexOf('"', i + 1);
      const end = j < 0 ? s.length : j;
      out.push({ lit: s.slice(i + 1, end) });
      i = end;
    } else if (c === "\\") {
      out.push({ lit: s[i + 1] ?? "" });
      i++;
    } else if (c === "_") {
      out.push({ lit: " " });
      i++;
    } else if (c === "*") {
      // Fill to the column width: TEXT has no column, so Excel drops it.
      i++;
    } else if (c === "[") {
      const j = s.indexOf("]", i);
      if (j < 0) out.push({ ch: c });
      else {
        out.push({ br: s.slice(i + 1, j) });
        i = j;
      }
    } else out.push({ ch: c });
  }
  return out;
}

function parseSection(s: string): Section | null {
  let color: string | null = null;
  let cond: Section["cond"] = null;
  const atoms: Atom[] = [];
  for (const a of toAtoms(s)) {
    if (!("br" in a)) {
      atoms.push(a);
      continue;
    }
    const low = a.br.toLowerCase();
    const condition = /^(<=|>=|<>|<|>|=)\s*(-?\d+(?:\.\d+)?)$/u.exec(a.br);
    const currency = /^\$([^-]*)(?:-[0-9a-f]+)?$/iu.exec(a.br);
    if (COLORS.includes(low) || /^color([1-9]|[1-4]\d|5[0-6])$/u.test(low)) color = low;
    else if (/^(h+|m+|s+)$/u.test(low)) atoms.push(a);
    else if (condition) cond = { op: condition[1] as string, val: Number(condition[2]) };
    else if (currency) {
      if (currency[1]) atoms.push({ lit: currency[1] });
    } else return null;
  }
  return { color, cond, atoms };
}

function meets(cond: { op: string; val: number }, n: number): boolean {
  const { op, val } = cond;
  if (op === "<") return n < val;
  if (op === "<=") return n <= val;
  if (op === ">") return n > val;
  if (op === ">=") return n >= val;
  if (op === "<>") return n !== val;
  return n === val;
}

/** The section a number uses, and whether Excel adds the minus sign itself. */
function pickSection(sections: Section[], n: number): { s: Section; sign: boolean } | null {
  const [first, second, third] = sections as [Section, Section?, Section?];
  if (first.cond || second?.cond) {
    // Up to two sections carry a condition; the next plain section takes the rest.
    for (const s of [first, second, third]) {
      if (!s) break;
      if (!s.cond) return { s, sign: true };
      if (meets(s.cond, n)) return { s, sign: true };
    }
    return null;
  }
  if (n < 0 && second) return { s: second, sign: false };
  if (n === 0 && third) return { s: third, sign: false };
  return { s: first, sign: true };
}

const bareText = (atoms: Atom[]) => atoms.map((a) => ("ch" in a ? a.ch : "")).join("");

function isDateSection(atoms: Atom[]): boolean {
  if (atoms.some((a) => "br" in a)) return true;
  const bare = bareText(atoms).replace(/general/giu, "");
  return (
    /[ydhs]/iu.test(bare) || /am\/pm|a\/p/iu.test(bare) || /^m+$/iu.test(bare) || /mmm/iu.test(bare)
  );
}

type DTok =
  | { k: "lit"; s: string }
  | { k: "y" | "m" | "d" | "h" | "s" | "min"; n: number }
  | { k: "ampm"; full: boolean; upper: boolean }
  | { k: "el"; u: "h" | "m" | "s"; n: number }
  | { k: "frac"; n: number };

/** A date or time section: dd-mmm-yyyy, h:mm AM/PM, [h]:mm, mm:ss.00 and the like. */
function formatDate(serial: number, atoms: Atom[]): string | null {
  if (serial < 0) return null;
  const toks: DTok[] = [];
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i] as Atom;
    if ("lit" in a) {
      toks.push({ k: "lit", s: a.lit });
      continue;
    }
    if ("br" in a) {
      const low = a.br.toLowerCase();
      toks.push({ k: "el", u: low[0] as "h" | "m" | "s", n: low.length });
      continue;
    }
    const rest = atoms
      .slice(i, i + 5)
      .map((x) => ("ch" in x ? x.ch : "\0"))
      .join("");
    const c = a.ch.toLowerCase();
    if (/^am\/pm/iu.test(rest)) {
      toks.push({ k: "ampm", full: true, upper: true });
      i += 4;
    } else if (/^a\/p/iu.test(rest)) {
      toks.push({ k: "ampm", full: false, upper: a.ch === "A" });
      i += 2;
    } else if ("ymdhs".includes(c)) {
      let n = 1;
      while (i + n < atoms.length) {
        const next = atoms[i + n] as Atom;
        if (!("ch" in next) || next.ch.toLowerCase() !== c) break;
        n++;
      }
      toks.push({ k: c as "y" | "m" | "d" | "h" | "s", n });
      i += n - 1;
    } else if (c === "." && toks.length && /^\.0+/u.test(rest)) {
      const prev = [...toks].reverse().find((t) => t.k !== "lit");
      if (prev && (prev.k === "s" || (prev.k === "el" && prev.u === "s"))) {
        const n = /^\.(0+)/u.exec(rest)?.[1]?.length ?? 1;
        toks.push({ k: "frac", n });
        i += n;
      } else toks.push({ k: "lit", s: a.ch });
    } else toks.push({ k: "lit", s: a.ch });
  }
  // m or mm is minutes right after an hour or right before seconds.
  const timed = toks.filter((t) => t.k !== "lit");
  for (let j = 0; j < timed.length; j++) {
    const t = timed[j] as DTok;
    if (t.k !== "m" || t.n > 2) continue;
    const before = timed[j - 1];
    const after = timed[j + 1];
    const isHour = (x?: DTok) => x?.k === "h" || (x?.k === "el" && x.u === "h");
    const isSecond = (x?: DTok) => x?.k === "s" || (x?.k === "el" && x.u === "s");
    if (isHour(before) || isSecond(after)) Object.assign(t, { k: "min" });
  }
  const places = Math.min(3, Math.max(0, ...toks.map((t) => (t.k === "frac" ? t.n : 0))));
  const unit = 10 ** places;
  const total = Math.round(serial * 86400 * unit);
  const days = Math.floor(total / (86400 * unit));
  const inDay = total - days * 86400 * unit;
  const secs = Math.floor(inDay / unit);
  const hour = Math.floor(secs / 3600);
  const minute = Math.floor(secs / 60) % 60;
  const second = secs % 60;
  const { year, month, day } = dateFromSerial(days);
  // Excel counts 1900-01-01 as a Sunday, so the weekday is (serial - 1) mod 7 from Sunday.
  const weekday = (((days - 1) % 7) + 7) % 7;
  const twelve = toks.some((t) => t.k === "ampm");
  const pad = (v: number, n: number) => String(v).padStart(n, "0");
  let out = "";
  for (const t of toks) {
    if (t.k === "lit") out += t.s;
    else if (t.k === "y") out += t.n <= 2 ? pad(year % 100, 2) : String(year);
    else if (t.k === "m") {
      const name = MONTHS[month - 1] ?? "";
      out +=
        t.n === 1
          ? month
          : t.n === 2
            ? pad(month, 2)
            : t.n === 3
              ? name.slice(0, 3)
              : t.n === 4
                ? name
                : name[0];
    } else if (t.k === "d") {
      const name = DAYS[weekday] ?? "";
      out += t.n === 1 ? day : t.n === 2 ? pad(day, 2) : t.n === 3 ? name.slice(0, 3) : name;
    } else if (t.k === "h") out += pad(twelve ? ((hour + 11) % 12) + 1 : hour, Math.min(t.n, 2));
    else if (t.k === "min") out += pad(minute, t.n);
    else if (t.k === "s") out += pad(second, Math.min(t.n, 2));
    else if (t.k === "ampm") {
      const pm = hour >= 12;
      const word = t.full ? (pm ? "PM" : "AM") : pm ? "P" : "A";
      out += t.upper ? word : word.toLowerCase();
    } else if (t.k === "el") {
      const whole = Math.floor(total / unit);
      const v =
        t.u === "h" ? Math.floor(whole / 3600) : t.u === "m" ? Math.floor(whole / 60) : whole;
      out += pad(v, t.n);
    } else out += `.${pad(inDay % unit, places).slice(0, t.n)}`;
  }
  return out;
}

type NTok =
  | { k: "lit"; s: string }
  | { k: "ph"; c: string }
  | { k: "dot" }
  | { k: "comma" }
  | { k: "pct" }
  | { k: "exp"; letter: string; plus: boolean }
  | { k: "gen" };

/** A number section: 0, #, ?, decimals, grouping, scaling, %, E+ and literals. */
function formatNumber(n: number, atoms: Atom[], sign: boolean): string | null {
  const toks: NTok[] = [];
  let seenDot = false;
  let seenExp = false;
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i] as Atom;
    if ("lit" in a) {
      toks.push({ k: "lit", s: a.lit });
      continue;
    }
    if ("br" in a) return null;
    const c = a.ch;
    const word = atoms
      .slice(i, i + 7)
      .map((x) => ("ch" in x ? x.ch : "\0"))
      .join("");
    const next = atoms[i + 1];
    if (/^general$/iu.test(word)) {
      toks.push({ k: "gen" });
      i += 6;
    } else if (c === "0" || c === "#" || c === "?") toks.push({ k: "ph", c });
    else if (c === "." && !seenDot && !seenExp) {
      seenDot = true;
      toks.push({ k: "dot" });
    } else if (c === ",") toks.push({ k: "comma" });
    else if (c === "%") toks.push({ k: "pct" });
    else if (
      (c === "E" || c === "e") &&
      !seenExp &&
      next &&
      "ch" in next &&
      /[+-]/u.test(next.ch)
    ) {
      seenExp = true;
      toks.push({ k: "exp", letter: c, plus: next.ch === "+" });
      i++;
    } else if (c === "/" && toks.some((t) => t.k === "ph")) {
      // shortcut: fraction codes such as # ?/? are not drawn; add them if a recipe needs one.
      return null;
    } else toks.push({ k: "lit", s: c });
  }
  const lead = sign && n < 0 ? "-" : "";
  const phAt = toks.map((t, i) => (t.k === "ph" ? i : -1)).filter((i) => i >= 0);
  if (!phAt.length) {
    const gen = toText(Math.abs(n)) as string;
    const body = toks
      .map((t) =>
        t.k === "lit" ? t.s : t.k === "pct" ? "%" : t.k === "gen" ? gen : t.k === "dot" ? "." : "",
      )
      .join("");
    return lead + body;
  }
  const expIdx = toks.findIndex((t) => t.k === "exp");
  const mantEnd = expIdx < 0 ? toks.length : expIdx;
  const dotIdx = toks.findIndex((t) => t.k === "dot");
  const intEnd = dotIdx < 0 ? mantEnd : dotIdx;
  const mantPh = phAt.filter((i) => i < mantEnd);
  const intPh = mantPh.filter((i) => i < intEnd);
  const fracPh = mantPh.filter((i) => i > intEnd);
  const expPh = phAt.filter((i) => i > mantEnd);
  const lastMant = mantPh[mantPh.length - 1] ?? -1;
  // A comma between integer placeholders groups thousands; one after the last placeholder divides by 1000.
  let grouped = false;
  let scale = 0;
  toks.forEach((t, i) => {
    if (t.k !== "comma" || i >= mantEnd) return;
    if (i > lastMant) scale++;
    else if (i < intEnd && intPh.some((p) => p < i) && intPh.some((p) => p > i)) grouped = true;
  });
  let v = Math.abs(n) * 100 ** toks.filter((t) => t.k === "pct").length;
  v /= 1000 ** scale;
  let exponent = 0;
  const places = fracPh.length;
  let rounded = roundTo(v, places, "half");
  if (expIdx >= 0 && v !== 0) {
    const width = Math.max(intPh.length, 1);
    const engineering = intPh.some((i) => (toks[i] as { c: string }).c === "#");
    let e = Math.floor(Math.log10(v));
    if (10 ** (e + 1) <= v) e++;
    const fit = (x: number) => (engineering ? Math.floor(x / width) * width : x - (width - 1));
    exponent = fit(e);
    rounded = roundTo(v / 10 ** exponent, places, "half");
    if (rounded >= 10 ** width) {
      exponent = fit(e + 1);
      rounded = roundTo(v / 10 ** exponent, places, "half");
    }
  }
  const [ipRaw = "0", fp = ""] = rounded.toFixed(places).split(".");
  const digits = ipRaw === "0" ? "" : ipRaw;
  // Integer digits fill placeholders from the right; extra digits go to the first one.
  const intOut = new Map<number, string>();
  let d = digits.length - 1;
  for (let p = intPh.length - 1; p >= 0; p--) {
    const at = intPh[p] as number;
    const c = (toks[at] as { c: string }).c;
    intOut.set(at, d >= 0 ? (digits[d--] as string) : c === "0" ? "0" : c === "?" ? " " : "");
  }
  const firstInt = intPh[0];
  if (d >= 0 && firstInt !== undefined)
    intOut.set(firstInt, digits.slice(0, d + 1) + intOut.get(firstInt));
  if (grouped && firstInt !== undefined) {
    const joined = intPh.map((i) => intOut.get(i)).join("");
    for (const i of intPh) intOut.set(i, "");
    intOut.set(
      firstInt,
      joined.replace(/\d+/u, (run) => run.replace(/\B(?=(\d{3})+(?!\d))/gu, ",")),
    );
  }
  // Trailing zero decimals vanish under # and turn into spaces under ?.
  const fracOut = fp.split("");
  for (let p = fracPh.length - 1; p >= 0; p--) {
    const c = (toks[fracPh[p] as number] as { c: string }).c;
    if (fracOut[p] !== "0" || c === "0") break;
    fracOut[p] = c === "?" ? " " : "";
  }
  const expDigits = String(Math.abs(exponent)).padStart(expPh.length, "0");
  let out = "";
  toks.forEach((t, i) => {
    if (t.k === "lit") out += t.s;
    else if (t.k === "pct") out += "%";
    else if (t.k === "gen") out += toText(v) as string;
    else if (t.k === "dot") {
      if (!intPh.length && digits) out += digits;
      out += ".";
    } else if (t.k === "exp")
      out += `${t.letter}${exponent < 0 ? "-" : t.plus ? "+" : ""}${expDigits}`;
    else if (t.k === "ph") {
      if (i < intEnd) out += intOut.get(i) ?? "";
      else if (i < mantEnd) out += fracOut[fracPh.indexOf(i)] ?? "";
      // Exponent placeholders are drawn at the E.
    }
  });
  return lead + out;
}

function formatTextSection(t: string, atoms: Atom[]): string {
  return atoms
    .map((a) => ("lit" in a ? a.lit : "ch" in a ? (a.ch === "@" ? t : a.ch) : ""))
    .join("");
}

/**
 * A value shown with an Excel format code, en-US. Null for a code this sheet
 * cannot draw (unknown [tags], fraction codes); TEXT turns that into #VALUE!.
 */
export function formatCode(
  value: string | number | boolean | null,
  code: string,
): Formatted | null {
  const plain = (text: string): Formatted => ({ text, color: null });
  if (code === "@" || /^general$/iu.test(code)) return plain(toText(value) as string);
  if (typeof value === "boolean") return plain(value ? "TRUE" : "FALSE");
  const sections: Section[] = [];
  for (const s of splitSections(code)) {
    const parsed = parseSection(s);
    if (!parsed) return null;
    sections.push(parsed);
  }
  const n = typeof value === "number" ? value : value === null ? 0 : parseNumericText(value);
  if (n === null) {
    const t = value as string;
    const own =
      sections[3] ??
      (sections.length === 1 && bareText(sections[0]?.atoms ?? []).includes("@")
        ? sections[0]
        : undefined);
    return own ? { text: formatTextSection(t, own.atoms), color: own.color } : plain(t);
  }
  const picked = pickSection(sections.slice(0, 3), n);
  if (!picked) return null;
  const { s, sign } = picked;
  const text = isDateSection(s.atoms) ? formatDate(n, s.atoms) : formatNumber(n, s.atoms, sign);
  return text === null ? null : { text, color: s.color };
}
