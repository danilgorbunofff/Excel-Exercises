// Why this exists: dates as Excel serial numbers in the 1900 date system.
// Serial 1 is 1 January 1900. Excel also counts 29 February 1900, a day that
// never existed, as serial 60; this module keeps that quirk so results match.
import type { FunctionSpec } from "../values.ts";
import { fail, fn, num, safe, text } from "./helpers.ts";

const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 30);

/** The serial number of a calendar date, normalising months and days the way Excel's DATE does. */
export function serialFromDate(year: number, month: number, day: number): number {
  const y = year < 1900 ? year + 1900 : year;
  if (y === 1900 && month === 2 && day === 29) return 60;
  const days = Math.round((Date.UTC(y, month - 1, day) - EPOCH) / DAY_MS);
  return days <= 60 ? days - 1 : days;
}

/** The calendar date of a serial number. */
export function dateFromSerial(serial: number): { year: number; month: number; day: number } {
  const s = Math.floor(serial);
  if (s === 0) return { year: 1900, month: 1, day: 0 };
  if (s === 60) return { year: 1900, month: 2, day: 29 };
  const d = new Date(EPOCH + (s < 60 ? s + 1 : s) * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

const serialArg = (arg: Parameters<typeof num>[0]) => {
  const s = num(arg);
  return s < 0 ? fail("#NUM!") : s;
};

/** A date moved by whole months. Day 31 in a 30-day month overflows, as DATE does. */
function addMonths(serial: number, months: number): number {
  const { year, month, day } = dateFromSerial(serial);
  return serialFromDate(year, month + months, day);
}

const DATEDIF_UNITS = new Set(["Y", "M", "D", "MD", "YM", "YD"]);

/** DATEDIF counts complete units: a month only counts once its day has come round. */
function datedif(start: number, end: number, unit: string): number {
  if (!DATEDIF_UNITS.has(unit) || start > end) return fail("#NUM!");
  const from = dateFromSerial(start);
  const to = dateFromSerial(end);
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  if (months > 0 && addMonths(start, months) > end) months -= 1;
  months = Math.max(0, months);
  if (unit === "D") return end - start;
  if (unit === "M") return months;
  if (unit === "Y") return Math.floor(months / 12);
  if (unit === "YM") return months % 12;
  if (unit === "MD") return end - addMonths(start, months);
  return end - addMonths(start, Math.floor(months / 12) * 12);
}

export const DATES: Record<string, FunctionSpec> = {
  DATE: fn(
    3,
    3,
    safe((args) => {
      const y = Math.trunc(num(args[0]));
      if (y < 0 || y > 9999) return fail("#NUM!");
      const s = serialFromDate(y, Math.trunc(num(args[1])), Math.trunc(num(args[2])));
      return s < 0 ? fail("#NUM!") : s;
    }),
  ),
  YEAR: fn(
    1,
    1,
    safe((args) => dateFromSerial(serialArg(args[0])).year),
  ),
  MONTH: fn(
    1,
    1,
    safe((args) => dateFromSerial(serialArg(args[0])).month),
  ),
  DAY: fn(
    1,
    1,
    safe((args) => dateFromSerial(serialArg(args[0])).day),
  ),
  WEEKDAY: fn(
    1,
    2,
    safe((args) => {
      const s = Math.floor(serialArg(args[0]));
      const type = Math.trunc(num(args[1], 1));
      const sunday1 = ((s - 1) % 7) + 1;
      if (type === 1) return sunday1;
      if (type === 2) return ((sunday1 + 5) % 7) + 1;
      if (type === 3) return (sunday1 + 5) % 7;
      return fail("#NUM!");
    }),
  ),
  EOMONTH: fn(
    2,
    2,
    safe((args) => {
      const { year, month } = dateFromSerial(serialArg(args[0]));
      return serialFromDate(year, month + Math.trunc(num(args[1])) + 1, 0);
    }),
  ),
  DAYS: fn(
    2,
    2,
    safe((args) => Math.floor(serialArg(args[0])) - Math.floor(serialArg(args[1]))),
  ),
  DATEDIF: fn(
    3,
    3,
    safe((args) =>
      datedif(
        Math.floor(serialArg(args[0])),
        Math.floor(serialArg(args[1])),
        text(args[2]).trim().toUpperCase(),
      ),
    ),
  ),
  // EDATE keeps the day where it can, and uses the month's last day when the
  // target month is shorter: one month after 31 January is 29 February in 2024.
  EDATE: fn(
    2,
    2,
    safe((args) => {
      const { year, month, day } = dateFromSerial(serialArg(args[0]));
      const target = month + Math.trunc(num(args[1]));
      const last = dateFromSerial(serialFromDate(year, target + 1, 0)).day;
      return serialFromDate(year, target, Math.min(day, last));
    }),
  ),
};
