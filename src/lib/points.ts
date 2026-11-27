// Why this exists: the one rule for points and user levels. The solve endpoint
// decides each award here from the account's ledger, and the pages show
// levels from the same table, so the server and the browser cannot disagree.
// Pure: no storage, no network.
import { addDays, REVIEW_GAPS } from "../scripts/progress.ts";
import { currentStreak } from "./daily.ts";

/** How many learners the scoreboard lists. */
export const BOARD_ROWS = 6;

interface Ranked<L> {
  rank: number;
  nickname: string;
  points: number;
  level: L;
}

/** The board shows BOARD_ROWS rows at most, the learner's own included. `rows` are the
 * listed ones, the learner's marked; `pinned` says to add their row under them,
 * in the last place, because they rank below it. A learner without a nickname is
 * not in the public top: when they rank high enough they take their place in it,
 * those below move down one and the last drops off. */
export function boardRows<L>(
  top: readonly Ranked<L>[],
  me: { nickname: string | null; rank: number | null; points: number; level: L } | null,
): { rows: (Ranked<L> & { mine: boolean })[]; pinned: boolean } {
  const rows = top.map((r) => ({ ...r, mine: r.nickname === me?.nickname }));
  if (!me || rows.some((r) => r.mine)) return { rows, pinned: false };
  if (me.rank !== null && me.rank <= BOARD_ROWS) {
    const found = rows.findIndex((r) => r.points <= me.points);
    const at = found === -1 ? rows.length : found;
    const own = { rank: me.rank, nickname: "", points: me.points, level: me.level, mine: true };
    const below = rows
      .slice(at)
      .map((r) => (r.points < me.points ? { ...r, rank: r.rank + 1 } : r));
    return { rows: [...rows.slice(0, at), own, ...below].slice(0, BOARD_ROWS), pinned: false };
  }
  const pinned = me.points > 0 || rows.length >= BOARD_ROWS;
  return { rows: pinned ? rows.slice(0, BOARD_ROWS - 1) : rows, pinned };
}

/** Points per difficulty level for a track exercise: 10, 20, 30. */
export const POINTS_PER_LEVEL = 10;
/** A function drill pays half of a track exercise. */
export const DRILL_PER_LEVEL = 5;
/** Extra for solving the daily exercise on its own day. */
export const DAILY_BONUS = 10;
/** A re-solve on a later day, once it is due for review. */
export const REVIEW_POINTS = 5;
/** Every this many daily exercises in a row pays STREAK_BONUS. */
export const STREAK_DAYS = 7;
export const STREAK_BONUS = 25;

export type TaskKind = "exercise" | "drill" | "daily";
export type AwardKind = "solve" | "review" | "daily" | "streak" | "backfill";

/** One ledger row, as the points table keeps it. */
export interface PointsRow {
  item: string;
  kind: AwardKind;
  day: string;
  points: number;
}

/** The points for solving a task the first time: half, rounded down, with help. */
export function solvePoints(kind: TaskKind, level: number, helped: boolean): number {
  const full = level * (kind === "drill" ? DRILL_PER_LEVEL : POINTS_PER_LEVEL);
  return helped ? Math.floor(full / 2) : full;
}

export interface Solve {
  kind: TaskKind;
  /** The ledger item: a step folds to its track exercise. */
  item: string;
  level: number;
  helped: boolean;
  /** The learner's day of the solve, YYYY-MM-DD. */
  day: string;
  /** For a daily task: whether it is the pick for that day. */
  isPick?: boolean;
}

/**
 * The rows a verified solve earns, given the account's earlier rows for the
 * same item and, for a daily task, its earlier daily rows. Empty when it earns
 * nothing: a past day's daily, a second solve before it is due, a same-day
 * re-solve.
 */
export function award(
  solve: Solve,
  itemRows: readonly PointsRow[],
  dailyRows: readonly PointsRow[] = [],
): PointsRow[] {
  const { kind, item, level, helped, day } = solve;
  if (kind === "daily") {
    if (!solve.isPick || dailyRows.some((r) => r.day === day)) return [];
    const out: PointsRow[] = [
      { item, kind: "daily", day, points: solvePoints(kind, level, helped) + DAILY_BONUS },
    ];
    const streak = currentStreak(new Set([...dailyRows.map((r) => r.day), day]), day);
    if (streak % STREAK_DAYS === 0) {
      out.push({ item: "streak", kind: "streak", day, points: STREAK_BONUS });
    }
    return out;
  }
  const paid = itemRows.filter((r) => r.kind !== "streak" && r.kind !== "daily");
  if (paid.length === 0) {
    return [{ item, kind: "solve", day, points: solvePoints(kind, level, helped) }];
  }
  const last =
    paid
      .map((r) => r.day)
      .sort()
      .at(-1) ?? day;
  const reviews = paid.filter((r) => r.kind === "review").length;
  const gap = REVIEW_GAPS[Math.min(reviews, REVIEW_GAPS.length - 1)] ?? 1;
  return day >= addDays(last, gap) ? [{ item, kind: "review", day, points: REVIEW_POINTS }] : [];
}

/** The points needed for each level, level 1 first. */
export const LEVEL_FLOORS = [
  0, 100, 220, 400, 600, 850, 1150, 1500, 1850, 2200, 2600, 3000, 3500, 4000, 4500, 5000, 5500,
  6000, 6500, 7000,
] as const;

const TITLES = [
  [20, "Master"],
  [16, "Expert"],
  [12, "Analyst"],
  [8, "Practitioner"],
  [4, "Learner"],
  [1, "Beginner"],
] as const;

export interface Level {
  level: number;
  title: string;
  /** Points where this level starts. */
  floor: number;
  /** Points where the next level starts, or null at the top. */
  next: number | null;
}

export function levelFor(points: number): Level {
  const i = LEVEL_FLOORS.findLastIndex((f) => points >= f);
  const level = Math.max(1, i + 1);
  const title = TITLES.find(([from]) => level >= from)?.[1] ?? "Beginner";
  return {
    level,
    title,
    floor: LEVEL_FLOORS[level - 1] ?? 0,
    next: LEVEL_FLOORS[level] ?? null,
  };
}

/** What /api/solves/ answers: what this solve earned and the new all-time total. */
export interface SolveResult {
  earned: { kind: AwardKind; points: number }[];
  total: number;
  level: Level;
}

/** Fired on document when a solve earned points, with the SolveResult. */
export const POINTS_EVENT = "formula-practice:points";

/** Nicknames on the scoreboard: 3 to 20 letters, digits or underscores. */
export const NICKNAME = /^[A-Za-z0-9_]{3,20}$/u;
