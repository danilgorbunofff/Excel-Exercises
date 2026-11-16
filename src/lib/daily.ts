// Why this exists: the daily exercise and the personal streak. The page, the
// API and the tests share it, so the browser and the server always agree on
// which exercise belongs to a day and on what a valid solve looks like.
//
// Since LADDER_START the daily is a weekly ladder: Monday is the easiest task
// and Sunday the hardest, drawn from content/daily/ (tasks that appear nowhere
// else). Before it, a hash picked a track exercise; those days stay valid.
import { addDays } from "../scripts/progress.ts";
import { isLocked } from "./access.ts";
import { FIRST_PICKS } from "./daily-legacy.ts";

/** The first day with a daily exercise. Older days are not accepted. */
export const DAILY_START = "2026-11-01";
/** The Monday the weekly ladder began. Earlier days used the legacy pick. */
export const LADDER_START = "2026-11-16";
/** How many days the strip shows. */
export const STRIP_DAYS = 14;
/** What each step of the week is called, Monday (1) to Sunday (7). */
export const TIER_NAMES = [
  "",
  "Warm-up",
  "Easy",
  "Steady",
  "Medium",
  "Tricky",
  "Hard",
  "Hardest",
] as const;
const MAX_SOLVES = 400;
const DAY = /^\d{4}-\d{2}-\d{2}$/u;

/** A daily-only task and its step of the week: 1 is Monday, 7 is Sunday. */
export interface DailyEntry {
  id: string;
  slug: string;
  tier: number;
}

/** The daily tasks, sorted by id. */
export const ladderPool = (tasks: readonly { id: string; slug: string; tier: number }[]) =>
  tasks
    .map(({ id, slug, tier }) => ({ id, slug, tier }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

/** The step of the week for a day: Monday 1 to Sunday 7. */
export const tierOf = (day: string): number =>
  ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** The Monday of the week a day is in. */
export const mondayOf = (day: string): string => addDays(day, 1 - tierOf(day));

/**
 * The daily task for a day on the ladder: that weekday's step, and within the
 * step the next task each week, so no task repeats until the step's list is
 * used up. Null before LADDER_START or for an empty step.
 */
export function pickFor(day: string, pool: readonly DailyEntry[]): DailyEntry | null {
  if (day < LADDER_START) return null;
  const tier = tierOf(day);
  const step = pool.filter((e) => e.tier === tier);
  if (step.length === 0) return null;
  const week = Math.floor((dayNumber(day) - dayNumber(LADDER_START)) / 7);
  return step[week % step.length] ?? null;
}

/** A track exercise in the legacy pick, which ran before LADDER_START. */
export interface PoolEntry {
  id: string;
  slug: string;
  /** A PRO exercise. The legacy pick used one on Saturdays. */
  pro: boolean;
}

/** Every track exercise, sorted by id, with whether it needs PRO: the legacy pool. */
export function dailyPool(
  placed: readonly { exercise: { id: string; slug: string }; topicNumber: number }[],
): PoolEntry[] {
  return placed
    .map((p) => ({ id: p.exercise.id, slug: p.exercise.slug, pro: isLocked(p) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** True when the day (YYYY-MM-DD) is a Saturday, when the legacy pick used a PRO exercise. */
const isProDay = (day: string): boolean => new Date(`${day}T00:00:00Z`).getUTCDay() === 6;

/**
 * FNV-1a, 32 bit, then the MurmurHash3 finaliser so the last characters (the
 * id) mix into every bit. The same in every browser and on the server.
 */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * The legacy pick, before the ladder: a PRO exercise on a Saturday, a free one
 * on other days. Each exercise scores hash(day:id) and the highest wins. Kept
 * so solves saved under it stay valid.
 */
export function legacyPickFor(day: string, pool: readonly PoolEntry[]): PoolEntry | null {
  const pro = isProDay(day);
  let best: PoolEntry | null = null;
  let bestScore = -1;
  for (const entry of pool) {
    if (entry.pro !== pro) continue;
    const score = hash(`${day}:${entry.id}`);
    if (score > bestScore || (score === bestScore && best !== null && entry.id < best.id)) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

/** True for a real calendar day written YYYY-MM-DD. */
export const isDay = (s: unknown): s is string =>
  typeof s === "string" && DAY.test(s) && addDays(s, 0) === s;

/** Days in a row up to today, or up to yesterday while today is not solved yet. */
export function currentStreak(days: ReadonlySet<string>, today: string): number {
  let day = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** The longest run of days in a row. */
export function bestStreak(days: ReadonlySet<string>): number {
  let best = 0;
  for (const day of days) {
    // Count only from the first day of each run.
    if (days.has(addDays(day, -1))) continue;
    let n = 1;
    while (days.has(addDays(day, n))) n++;
    best = Math.max(best, n);
  }
  return best;
}

/** The last n days, oldest first, ending today. */
export function stripDays(
  days: ReadonlySet<string>,
  today: string,
  n = STRIP_DAYS,
): { day: string; solved: boolean; today: boolean }[] {
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    return { day, solved: days.has(day), today: day === today };
  });
}

/** This week's ladder, Monday to Sunday, with each day's step and whether it has come yet. */
export function weekDays(
  days: ReadonlySet<string>,
  today: string,
): { day: string; tier: number; solved: boolean; today: boolean; future: boolean }[] {
  const monday = mondayOf(today);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return { day, tier: i + 1, solved: days.has(day), today: day === today, future: day > today };
  });
}

export interface DailySolve {
  day: string;
  exercise: string;
}

/**
 * The valid solves; anything else is dropped. Null when the body is not a
 * short list or nothing in it is valid. A day must be real, not before
 * DAILY_START, and not after tomorrow in UTC (time zones reach UTC+14). The
 * exercise must be that day's pick: it is recomputed, not trusted. Dropping
 * rather than refusing the batch means one stale day (an exercise since made
 * PRO or removed) cannot block a browser's whole upload.
 * shortcut: a visitor can still post solves for past days they never did. It
 * only changes their own streak, which nobody else sees.
 */
export function cleanDailySolves(
  body: unknown,
  pools: { ladder: readonly DailyEntry[]; legacy: readonly PoolEntry[] },
  todayUtc: string,
): DailySolve[] | null {
  if (!Array.isArray(body) || body.length === 0 || body.length > MAX_SOLVES) return null;
  const latest = addDays(todayUtc, 1);
  const out: DailySolve[] = [];
  const seen = new Set<string>();
  for (const raw of body as unknown[]) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const day = r["day"];
    if (!isDay(day) || day < DAILY_START || day > latest || seen.has(day)) continue;
    // A day solved under the legacy pick stays valid, even one after the
    // ladder began but before the site switched to it.
    const exercise = r["exercise"];
    if (
      exercise !== pickFor(day, pools.ladder)?.id &&
      exercise !== legacyPickFor(day, pools.legacy)?.id &&
      exercise !== FIRST_PICKS[day]
    )
      continue;
    seen.add(day);
    out.push({ day, exercise: r["exercise"] as string });
  }
  return out.length > 0 ? out : null;
}

/**
 * Joins this browser's days with the account's. The account's exercise wins
 * on a day both have. Missing: the browser's days the account lacks, to send.
 */
export function mergeDaily(
  local: Readonly<Record<string, string>>,
  server: readonly DailySolve[],
): { days: Record<string, string>; missing: DailySolve[] } {
  const days: Record<string, string> = { ...local };
  for (const s of server) days[s.day] = s.exercise;
  const known = new Set(server.map((s) => s.day));
  const missing = Object.entries(local)
    .filter(([day]) => !known.has(day) && isDay(day) && day >= DAILY_START)
    .map(([day, exercise]) => ({ day, exercise }));
  return { days, missing };
}
