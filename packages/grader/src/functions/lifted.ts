// Why this exists: the arguments Excel 365 takes one value at a time. Given a
// range or array there, Excel runs the function once per cell and spills the
// results, so LEN(A2:A9), ISNUMBER(SEARCH("a",A2:A9)) or COUNTIF(B2:B9,
// {"North","South"}) work. The evaluator broadcasts these arguments; every
// other argument is passed whole, as before.

const all = (n: number) => Array.from({ length: n }, (_, i) => i);
const first = () => [0];
const upTo = (k: number) => (n: number) => all(Math.min(n, k));
/** Criteria at 1, 3, 5... (COUNTIFS) or at 2, 4, 6... (SUMIFS and the like). */
const criteriaFrom = (start: number) => (n: number) =>
  all(n).filter((i) => i >= start && (i - start) % 2 === 0);

export const LIFTED: Readonly<Record<string, (count: number) => readonly number[]>> = {
  // Text
  LEN: first,
  TRIM: first,
  UPPER: first,
  LOWER: first,
  PROPER: first,
  VALUE: first,
  LEFT: upTo(2),
  RIGHT: upTo(2),
  MID: upTo(3),
  FIND: upTo(3),
  SEARCH: upTo(3),
  SUBSTITUTE: upTo(4),
  REPLACE: upTo(4),
  EXACT: upTo(2),
  CONCATENATE: all,
  TEXT: upTo(2),
  TEXTBEFORE: (n) => [0, 2].filter((i) => i < n),
  TEXTAFTER: (n) => [0, 2].filter((i) => i < n),
  // Maths
  ABS: first,
  INT: first,
  SQRT: first,
  ODD: first,
  EVEN: first,
  ROUND: upTo(2),
  ROUNDUP: upTo(2),
  ROUNDDOWN: upTo(2),
  MROUND: upTo(2),
  FLOOR: upTo(2),
  CEILING: upTo(2),
  MOD: upTo(2),
  // Dates
  DATE: upTo(3),
  YEAR: first,
  MONTH: first,
  DAY: first,
  HOUR: first,
  WEEKDAY: upTo(2),
  EOMONTH: upTo(2),
  EDATE: upTo(2),
  DAYS: upTo(2),
  DATEDIF: upTo(3),
  // Information and logic
  ISNUMBER: first,
  ISTEXT: first,
  ISBLANK: first,
  ISNA: first,
  ISERROR: first,
  NOT: first,
  IFERROR: upTo(2),
  IFNA: upTo(2),
  CHOOSE: first,
  // Lookups: the value looked for
  VLOOKUP: first,
  HLOOKUP: first,
  MATCH: first,
  XMATCH: first,
  XLOOKUP: first,
  // Criteria and k
  COUNTIF: (n) => (n > 1 ? [1] : []),
  SUMIF: (n) => (n > 1 ? [1] : []),
  AVERAGEIF: (n) => (n > 1 ? [1] : []),
  COUNTIFS: criteriaFrom(1),
  SUMIFS: criteriaFrom(2),
  AVERAGEIFS: criteriaFrom(2),
  MAXIFS: criteriaFrom(2),
  MINIFS: criteriaFrom(2),
  LARGE: (n) => (n > 1 ? [1] : []),
  RANK: first,
  SMALL: (n) => (n > 1 ? [1] : []),
};
