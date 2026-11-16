// Why this exists: the daily exercise and the personal streak. The page, the
// API and the tests share it, so the browser and the server always agree on
// which exercise belongs to a day and on what a valid solve looks like.
import { addDays } from "../scripts/progress.ts";
import { isLocked } from "./access.ts";

/** The first day with a daily exercise. Older days are not accepted. */
export const DAILY_START = "2026-11-01";
/** How many days the strip shows. */
export const STRIP_DAYS = 14;
const MAX_SOLVES = 400;
const DAY = /^\d{4}-\d{2}-\d{2}$/u;

export interface PoolEntry {
  id: string;
  slug: string;
  /** A PRO exercise. It is the daily only on a Saturday, open to everyone that day. */
  pro: boolean;
}

/** Every exercise, sorted by id, with whether it needs PRO. */
export function dailyPool(
  placed: readonly { exercise: { id: string; slug: string }; topicNumber: number }[],
): PoolEntry[] {
  return placed
    .map((p) => ({ id: p.exercise.id, slug: p.exercise.slug, pro: isLocked(p) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** True when the day (YYYY-MM-DD) is a Saturday, the day a PRO exercise is the daily. */
export const isProDay = (day: string): boolean => new Date(`${day}T00:00:00Z`).getUTCDay() === 6;

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
 * The exercise for a day: a PRO one on a Saturday, a free one on other days.
 * Each exercise scores hash(day:id) and the highest wins, so adding or
 * removing one exercise only changes the days it wins.
 */
export function pickFor(day: string, pool: readonly PoolEntry[]): PoolEntry | null {
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
  pool: readonly PoolEntry[],
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
    if (r["exercise"] !== pickFor(day, pool)?.id) continue;
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
