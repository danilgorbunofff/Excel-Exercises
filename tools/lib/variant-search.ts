// Why this exists: when a wrong formula (a mutant of the reference answer)
// passes every sheet of a screen, the data does not tell it apart from the
// right one. This proposes variants (one changed cell each) that do: each one
// changes the expected result, keeps every accepted formula right, and fails
// as many of those wrong formulas as possible. The grader computes; Excel then
// confirms the chosen variants before they go into the content.
import {
  type CellInput,
  createGrid,
  type Expected,
  evaluateFormula,
  grade,
  parse,
  parseAddress,
  walkAst,
} from "@practice/grader";
import { patch, specOf, type TaskScreen } from "./audit-tasks.ts";
import { toExcelShape } from "./excel-compare.ts";

export interface Proposal {
  set: Record<string, CellInput>;
  expected: Expected;
  kills: string[];
  /** Lower is more realistic: the order the change was tried in. */
  rank?: number;
}

const letters = (n: number) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26))
    s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

/** The reference answer's result on a sheet, in the shape a screen's expected takes, or null if it errs. */
export function resultOn(answer: string, rows: CellInput[][], cell: string): Expected | null {
  const at = parseAddress(cell);
  if (!at) return null;
  const v = toExcelShape(evaluateFormula(answer, createGrid(rows), at));
  const plain = (x: unknown): CellInput | undefined =>
    x === null || typeof x === "number" || typeof x === "string" || typeof x === "boolean"
      ? (x as CellInput)
      : undefined;
  if (Array.isArray(v)) {
    const block = v.map((r) => r.map(plain));
    return block.every((r) => r.every((x) => x !== undefined)) ? (block as CellInput[][]) : null;
  }
  const p = plain(v);
  return p === undefined || p === null ? null : p;
}

/** Cells the reference answer reads, and the numbers it compares with. */
function readsOf(answer: string): { cells: { col: number; row: number }[]; numbers: number[] } {
  const p = parse(answer);
  const cells: { col: number; row: number }[] = [];
  const numbers: number[] = [];
  if (!p.ok) return { cells, numbers };
  walkAst(p.ast, (n) => {
    if (n.type === "ref") cells.push({ col: n.address.col, row: n.address.row });
    if (n.type === "range" && n.first.col && n.first.row && n.last.col && n.last.row)
      for (let r = n.first.row; r <= n.last.row; r++)
        for (let c = n.first.col; c <= n.last.col; c++) cells.push({ col: c, row: r });
    if (n.type === "number") numbers.push(n.value);
    if (n.type === "string") {
      const m = /^(?:>=|<=|<>|>|<|=)?(-?\d+(?:\.\d+)?)$/u.exec(n.value);
      if (m) numbers.push(Number(m[1]));
    }
  });
  return { cells, numbers };
}

/** Single-cell changes worth trying: thresholds, neighbours of the value, other values of its column. */
function changes(t: TaskScreen): Record<string, CellInput>[] {
  const s = t.screen;
  const answerAt = parseAddress(s.answerCell);
  const { cells, numbers } = readsOf(s.answer);
  const seen = new Set<string>();
  const out: Record<string, CellInput>[] = [];
  // Text the formula reads anywhere, so a lookup input can take a key from its table.
  const readText = [
    ...new Set(
      cells
        .filter(({ row }) => row > 1)
        .map(({ col, row }) => s.rows[row - 1]?.[col - 1])
        .filter((x) => typeof x === "string"),
    ),
  ] as string[];
  for (const { col, row } of cells) {
    const v = s.rows[row - 1]?.[col - 1] ?? null;
    const address = `${letters(col)}${row}`;
    if (address === s.answerCell || row === 1 || v === null) continue;
    if (answerAt && answerAt.row === row && answerAt.col === col) continue;
    const column = s.rows.slice(1).map((r) => r[col - 1] ?? null);
    const tries: CellInput[] = [];
    if (typeof v === "number") {
      const nums = column.filter((c): c is number => typeof c === "number");
      const step = Number.isInteger(v) ? 1 : 0.5;
      // A date serial (2000 to 2099) moves by days, a month or a year, not by a factor.
      const date = Number.isInteger(v) && v >= 36526 && v <= 73050;
      // Most realistic first: values the column already holds, the formula's
      // thresholds and their neighbours, then small and larger moves.
      for (const c of nums) tries.push(c);
      tries.push(...numbers, ...numbers.map((n) => n + step), ...numbers.map((n) => n - step));
      const whole = (x: number) =>
        Number.isInteger(v) ? Math.round(x) : Math.round(x * 100) / 100;
      if (date) tries.push(v + 7, v - 7, v + 30, v - 30, v + 365, v - 365);
      else tries.push(v + step * 7, v - step * 7, whole(v * 1.37), whole(v * 2), whole(v * 0.5));
      // Least realistic last: a value not filled in yet.
      tries.push(null);
      // A column with no negative numbers gets none.
      if (nums.every((c) => c >= 0))
        for (let i = tries.length - 1; i >= 0; i--) {
          const x = tries[i];
          if (typeof x === "number" && x < 0) tries.splice(i, 1);
        }
    } else if (typeof v === "string") {
      for (const c of column) if (typeof c === "string" && c !== v) tries.push(c);
      tries.push(...readText);
      const flip = { yes: "No", no: "Yes", y: "N", n: "Y" }[v.toLowerCase()];
      if (flip) tries.push(v === v.toUpperCase() ? flip.toUpperCase() : flip);
    } else if (typeof v === "boolean") tries.push(!v);
    for (const x of tries) {
      if (x === v || (typeof x === "number" && !Number.isFinite(x))) continue;
      const key = `${address}=${JSON.stringify(x)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ [address]: x });
    }
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Up to max variants that, together, fail the most of the given wrong formulas,
 * each changing the expected result and keeping every formula in keep right.
 */
export function proposeVariants(
  t: TaskScreen,
  wrong: readonly string[],
  keep: readonly string[],
  max = 4,
  skip: readonly Record<string, CellInput>[] = [],
): {
  proposals: Proposal[];
  unkilled: string[];
  blocked?: Proposal & { blockers: string[] };
} {
  const s = t.screen;
  const key = (set: Record<string, CellInput>) =>
    JSON.stringify(Object.fromEntries(Object.entries(set).sort()));
  const existing = new Set([...(s.variants ?? []).map((v) => key(v.set)), ...skip.map(key)]);
  const baseExpected = s.expected;
  const options: Proposal[] = [];
  const singles = changes(t);
  let blocked: (Proposal & { blockers: string[] }) | undefined;
  // Two cells at once, for results that need both inputs moved, such as AND of two tests.
  const pairs: Record<string, CellInput>[] = [];
  for (let i = 0; i < singles.length && pairs.length < 4000; i++)
    for (let j = i + 1; j < singles.length; j++) {
      const a = singles[i] as Record<string, CellInput>;
      const b = singles[j] as Record<string, CellInput>;
      // A blank is tried on its own only.
      if (Object.values(a)[0] === null || Object.values(b)[0] === null) continue;
      if (Object.keys(a)[0] !== Object.keys(b)[0]) pairs.push({ ...a, ...b });
    }
  for (const [rank, set] of [...singles, ...pairs].entries()) {
    if (existing.has(key(set))) continue;
    const rows = patch(s.rows, set);
    const expected = resultOn(s.answer, rows, s.answerCell);
    if (expected === null) continue;
    // Graded as the site will: the base sheet plus this one change as a variant.
    const spec = { ...specOf(s), variants: [{ set, expected }] };
    const kills = wrong.filter((f) => !grade(f, spec).correct);
    const blockers = keep.filter((f) => !grade(f, spec).correct);
    if (blockers.length) {
      // Kept for review: an accepted formula that fails here may itself be wrong.
      if (kills.length && kills.length > (blocked?.kills.length ?? 0))
        blocked = { set, expected, kills, blockers };
      continue;
    }
    if (kills.length) options.push({ set, expected, kills, rank });
  }
  const chosen: Proposal[] = [];
  let left = [...wrong];
  // A variant should change the result. Only for wrong formulas none of those
  // catch (such as the other branch of an AND) does one keep the base result.
  for (const changing of [true, false]) {
    const pool = options.filter((o) => same(o.expected, baseExpected) !== changing);
    while (chosen.length < max && left.length) {
      // Most wrong formulas failed first; then the fewest cells changed.
      const best = pool
        .map((o) => ({ o, n: o.kills.filter((k) => left.includes(k)).length }))
        .sort(
          (a, b) =>
            b.n - a.n ||
            Object.keys(a.o.set).length - Object.keys(b.o.set).length ||
            (a.o.rank ?? 0) - (b.o.rank ?? 0),
        )[0];
      if (!best || best.n === 0) break;
      chosen.push(best.o);
      left = left.filter((f) => !best.o.kills.includes(f));
    }
  }
  return {
    proposals: chosen,
    unkilled: left,
    ...(left.length && blocked ? { blocked } : {}),
  };
}
