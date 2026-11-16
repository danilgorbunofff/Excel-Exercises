// Why this exists: ground truth for the grader audit. It drives the Microsoft
// Excel installed on this Mac through JavaScript for Automation: write a grid,
// enter a formula with formula2 (so dynamic arrays spill as in Excel 365),
// recalculate, and read the value and any spilled block back. Results are
// cached by case, so a rerun needs no Excel. macOS only.
// shortcut: Excel follows the system region (here en_CZ, decimal comma), and
// scripts cannot switch its separators, so cases that turn text into numbers
// or numbers into text must be marked locale-sensitive and checked in en-US.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type Cell = number | string | boolean | null;
/** An Excel result. Errors are their code, such as "#N/A". */
export type ExcelScalar = number | string | boolean | null | { error: string };

export interface ExcelCase {
  rows: readonly (readonly Cell[])[];
  formula: string;
  /** Where the formula goes, such as "F2". */
  cell: string;
  /** Also read back the formula Excel stored, to see whether it rewrote it. */
  readFormula?: boolean;
  /** Lower runs first, so the cases that matter most are cached first. Not part of the cache key. */
  priority?: number;
}

export interface ExcelResult {
  /** The answer cell's value, or the spilled block when the formula spills. */
  value: ExcelScalar | ExcelScalar[][];
  /** Excel refused the formula as typed. */
  invalid?: string;
  /** The formula Excel stored, when asked for. */
  formula?: string;
}

export const cacheKey = (c: ExcelCase) =>
  createHash("sha256")
    .update(JSON.stringify([c.rows, c.formula, c.cell, c.readFormula ?? false]))
    .digest("hex")
    .slice(0, 20);

/** A local date-time Excel returned, as its serial number (1900 date system). */
export function serialFromLocal(d: Date): number {
  const utc = Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
  );
  return (utc - Date.UTC(1899, 11, 30)) / 86400000;
}

// Runs inside osascript. One workbook for the batch. A sheet is written once
// for consecutive cases on it; AZ300 reports the spill size of the formula cell.
const JXA = String.raw`
function run(argv) {
  const cases = JSON.parse($.NSString.stringWithContentsOfFileEncodingError(argv[0], $.NSUTF8StringEncoding, null).js);
  const xl = Application("Microsoft Excel");
  try { xl.screenUpdating = false; } catch (e) {}
  // By name, not "active": another Excel window must not redirect the writes.
  const book = xl.make({ new: "workbook" }).name();
  const wb = xl.workbooks.byName(book);
  const ws = wb.worksheets[0];
  // Each formula must calculate as it is entered. calculation is an application
  // setting, so it is put back as it was at the end.
  const calcBefore = xl.calculation();
  if (calcBefore !== "calculation automatic") xl.calculation = "calculation automatic";
  const out = [];
  const conv = (v) => v instanceof Date
    ? { date: true, y: v.getFullYear(), m: v.getMonth(), d: v.getDate(), h: v.getHours(), mi: v.getMinutes(), s: v.getSeconds() }
    : v;
  const errOr = (r, v) => {
    if (v !== null && v !== undefined) return conv(v);
    const s = r.stringValue();
    return s && s[0] === "#" ? { error: s } : null;
  };
  const col = (n) => { let s = ""; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
  let last = "";
  let lastCell = "";
  let lastBlock = "";
  for (const c of cases) try {
    // Consecutive cases on the same sheet reuse it; only the last result block is
    // cleared, formats included: a date format left behind would turn the next
    // number into a date.
    const key = JSON.stringify(c.rows);
    if (key !== last) {
      ws.ranges["A1:AZ300"].clearContents();
      ws.ranges["A1:AZ300"].clearFormats();
      const w = Math.max(...c.rows.map((r) => r.length));
      const grid = c.rows.map((r) => Array.from({ length: w }, (_, j) => {
        const v = r[j] === undefined ? null : r[j];
        return typeof v === "string" ? "'" + v : v === null ? "" : v;
      }));
      ws.ranges["A1:" + col(w - 1) + c.rows.length].value = grid;
      last = key;
      lastCell = "";
      lastBlock = "";
    } else if (lastBlock) ws.ranges[lastBlock].clearContents();
    if (c.cell !== lastCell) ws.ranges["AZ300"].formula2 = "=IFERROR(ROWS(" + c.cell + "#)*1000+COLUMNS(" + c.cell + "#),0)";
    lastCell = c.cell;
    try {
      ws.ranges[c.cell].formula2 = c.formula;
    } catch (e) {
      out.push({ invalid: String(e) });
      continue;
    }
    const dims = ws.ranges["AZ300"].value();
    const rows = Math.floor(dims / 1000), cols = dims % 1000;
    const m = c.cell.match(/^([A-Z]+)(\d+)$/);
    let c0 = 0; for (const ch of m[1]) c0 = c0 * 26 + ch.charCodeAt(0) - 64;
    const r0 = Number(m[2]);
    lastBlock = rows * cols > 1 ? c.cell + ":" + col(c0 - 1 + cols - 1) + (r0 + rows - 1) : c.cell;
    // A result Excel formatted as a date reads back as a Date: set General and read
    // again, so it comes back as its serial. A format left on a cell is harmless,
    // since every read that meets a Date resets its own block.
    const isDate = (v) => v instanceof Date || (Array.isArray(v) && v.some((r) => r.some((x) => x instanceof Date)));
    let raw = ws.ranges[lastBlock].value();
    if (isDate(raw)) {
      ws.ranges[lastBlock].numberFormat = "General";
      raw = ws.ranges[lastBlock].value();
    }
    if (rows * cols > 1) {
      const block = raw;
      out.push({ value: block.map((line, i) => line.map((v, j) => (v === null || v === undefined || v === "")
        ? errOr(ws.ranges[col(c0 - 1 + j) + (r0 + i)], null) ?? v
        : conv(v))) });
    } else {
      const r = ws.ranges[c.cell];
      out.push(c.readFormula ? { value: errOr(r, raw), formula: r.formula2() } : { value: errOr(r, raw) });
    }
  } catch (e) {
    out.push({ invalid: "runner: " + String(e) });
    last = "";
  }
  // If Excel lost the workbook mid-run, the cases above already say so.
  try {
    if (calcBefore && calcBefore !== "calculation automatic") xl.calculation = calcBefore;
    wb.close({ saving: "no" });
  } catch (e) {}
  return JSON.stringify(out);
}`;

type Raw = { value?: unknown; invalid?: string; formula?: string };
const fromRaw = (v: unknown): ExcelScalar => {
  if (v && typeof v === "object" && "date" in v) {
    const d = v as unknown as { y: number; m: number; d: number; h: number; mi: number; s: number };
    return serialFromLocal(new Date(d.y, d.m, d.d, d.h, d.mi, d.s));
  }
  return v as ExcelScalar;
};

/** Runs every case not in the cache through Excel, then returns all results in order. */
export function runInExcel(
  cases: readonly ExcelCase[],
  cachePath?: string,
  { cacheOnly = false } = {},
): ExcelResult[] {
  const cache: Record<string, ExcelResult> =
    cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  // Only what is cached, without starting Excel: for reading results while a run goes on.
  if (cacheOnly)
    return cases.map((c) => cache[cacheKey(c)] ?? { value: null, invalid: "not cached" });
  // Sorted by sheet, so each sheet is written once per batch.
  const seen = new Set<string>();
  const missing = cases
    .filter((c) => {
      const k = cacheKey(c);
      if (k in cache || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort(
      (a, b) =>
        (a.priority ?? 0) - (b.priority ?? 0) ||
        JSON.stringify(a.rows).localeCompare(JSON.stringify(b.rows)),
    );
  if (missing.length) {
    const dir = mkdtempSync(join(tmpdir(), "excel-bridge-"));
    // Two runs driving Excel at once corrupt each other's sheets: take a lock.
    const lock = join(tmpdir(), "excel-bridge.lock");
    for (;;) {
      try {
        mkdirSync(lock);
        break;
      } catch {
        execFileSync("sleep", ["2"]);
      }
    }
    try {
      writeFileSync(join(dir, "run.js"), JXA);
      for (let i = 0; i < missing.length; i += 100) {
        const batch = missing.slice(i, i + 100);
        writeFileSync(join(dir, "cases.json"), JSON.stringify(batch));
        const raw = JSON.parse(
          execFileSync(
            "osascript",
            ["-l", "JavaScript", join(dir, "run.js"), join(dir, "cases.json")],
            { encoding: "utf8", maxBuffer: 64 << 20 },
          ),
        ) as Raw[];
        batch.forEach((c, k) => {
          const r = raw[k] ?? { invalid: "no result" };
          cache[cacheKey(c)] = r.invalid
            ? { value: null, invalid: r.invalid }
            : {
                value: Array.isArray(r.value)
                  ? (r.value as unknown[][]).map((row) => row.map(fromRaw))
                  : fromRaw(r.value),
                ...(r.formula ? { formula: r.formula } : {}),
              };
        });
        if (cachePath) writeFileSync(cachePath, `${JSON.stringify(cache, null, 1)}\n`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(lock, { recursive: true, force: true });
    }
  }
  return cases.map((c) => cache[cacheKey(c)] as ExcelResult);
}
