// Why this exists: progress lives in the browser only. Nothing is sent
// anywhere. Storage can be blocked or full, so every access is guarded and the
// page works without it. Solved exercises come back for review after growing
// gaps, so practice is spaced out over weeks.

import { parentOf } from "../lib/steps.ts";

/**
 * tried: checked with a wrong formula, not solved yet. revealed: the answer was
 * shown, not yet solved. helped: solved after the answer was shown.
 */
export type ProgressState = "tried" | "revealed" | "solved" | "helped";
export interface ProgressEntry {
  state: ProgressState;
  /** The day this state was first reached, YYYY-MM-DD in local time. */
  date: string;
  /** The day of the latest solve, for review. Absent while only revealed. */
  last?: string;
  /** How many times it was solved again on a later day. */
  reviews?: number;
  /** How many wrong checks, ever. */
  misses?: number;
  /** The day of the latest wrong check. */
  missed?: string;
}
export type Progress = Record<string, ProgressEntry>;

export const STORAGE_KEY = "formula-practice:progress:v1";
/** Fired on document after each record(). */
export const PROGRESS_EVENT = "formula-practice:progress";
/** Days from the latest solve until the next review, by the number of reviews so far. */
export const REVIEW_GAPS = [1, 3, 7, 21, 60] as const;

export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000;
};

export function addDays(iso: string, days: number): string {
  return new Date((dayNumber(iso) + days) * 86_400_000).toISOString().slice(0, 10);
}

export function readProgress(storage: Storage | undefined = globalThis.localStorage): Progress {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Progress) : {};
  } catch {
    return {};
  }
}

/**
 * Records a solve, a shown answer or a wrong check. A solve after the answer
 * was shown is "solved with help". Showing the answer after a solve changes
 * nothing. A solve on a later day than the last one counts as a review. A
 * wrong check only counts the miss; it never undoes a solve.
 */
export function record(
  id: string,
  event: "solved" | "revealed" | "missed",
  storage: Storage | undefined = globalThis.localStorage,
  today = localDay(),
): ProgressEntry {
  const all = readProgress(storage);
  const before = all[id];
  let entry: ProgressEntry;
  if (event === "missed") {
    const base = before ?? { state: "tried", date: today };
    entry = { ...base, misses: (base.misses ?? 0) + 1, missed: today };
  } else if (event === "revealed") {
    entry =
      !before || before.state === "tried" ? { ...before, state: "revealed", date: today } : before;
  } else if (!before || before.state === "revealed" || before.state === "tried") {
    entry = {
      ...before,
      state: before?.state === "revealed" ? "helped" : "solved",
      date: today,
      last: today,
      reviews: 0,
    };
  } else {
    const later = before.last !== undefined && today > before.last;
    entry = {
      ...before,
      last: today,
      reviews: (before.reviews ?? 0) + (later ? 1 : 0),
    };
  }
  all[id] = entry;
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage is blocked or full: the page still works, progress is not kept.
  }
  // Signed in, session.ts sends this to the account.
  globalThis.document?.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: { id, entry } }));
  return entry;
}

/**
 * The days with any practice, each with how many things happened on it: an
 * exercise first reached, solved or got wrong, plus any extra days (the
 * daily solves).
 * shortcut: each exercise keeps only its first, latest-solve and latest-miss
 * day, so older practice days drop out; store a day log if the full history
 * ever matters.
 */
export function activeDays(progress: Progress, more: Iterable<string> = []): Map<string, number> {
  const days = new Map<string, number>();
  const add = (day: string) => days.set(day, (days.get(day) ?? 0) + 1);
  for (const e of Object.values(progress)) {
    for (const day of new Set([e.date, e.last, e.missed])) if (day) add(day);
  }
  for (const day of more) add(day);
  return days;
}

/** The day a solved exercise is next due for review, or null if it is not solved. */
export function dueDate(entry: ProgressEntry): string | null {
  if (entry.state === "revealed" || entry.state === "tried" || !entry.last) return null;
  const gap = REVIEW_GAPS[Math.min(entry.reviews ?? 0, REVIEW_GAPS.length - 1)] ?? 1;
  return addDays(entry.last, gap);
}

export function isDue(entry: ProgressEntry, today = localDay()): boolean {
  const due = dueDate(entry);
  return due !== null && due <= today;
}

const RANK: Record<ProgressState, number> = { tried: 0, revealed: 1, helped: 2, solved: 3 };

const latest = (...days: (string | undefined)[]) =>
  days
    .filter((d): d is string => d !== undefined)
    .sort()
    .at(-1);

/** Solved, on its own or with help. */
export const isSolved = (entry: ProgressEntry | undefined): boolean =>
  entry?.state === "solved" || entry?.state === "helped";

/**
 * Whether an exercise belongs on the review list: missed and not solved since,
 * or solved and due again.
 */
export function needsReview(entry: ProgressEntry | undefined, today = localDay()): boolean {
  if (!entry) return false;
  const missedSinceSolve =
    (entry.misses ?? 0) > 0 && (!isSolved(entry) || (entry.missed ?? "") > (entry.last ?? ""));
  return missedSinceSolve || isDue(entry, today);
}

/**
 * Joins progress from two places, such as this browser and the account. For
 * each exercise it keeps the furthest state, the first day, the latest solve
 * and the most reviews, so merging never loses work.
 */
/**
 * Drops the entries last touched before `day` (YYYY-MM-DD): this device's
 * copy of progress the account cleared since. An entry touched on the day
 * itself stays.
 * shortcut: day precision, so an old entry from the very day of the clear
 * survives; store times on entries if that ever matters.
 */
export function dropClearedBefore(progress: Progress, day: string): Progress {
  const touched = (e: ProgressEntry) =>
    [e.date, e.last, e.missed]
      .filter((d): d is string => d !== undefined)
      .sort()
      .at(-1) ?? e.date;
  return Object.fromEntries(Object.entries(progress).filter(([, e]) => touched(e) >= day));
}

/**
 * Progress by track exercise: each exercise's ladder steps (<id>-step-<n>,
 * lib/steps.ts) fold into it, so solving any step counts as solving the
 * exercise. Its state is the best, its first day the earliest, its latest
 * solve and miss the latest, its misses added up, and each further step solved
 * counts as a review.
 * shortcut: two steps solved on the same day count as two reviews; store solve
 * days on entries if that skews the review gaps.
 */
export function foldSets(progress: Progress): Progress {
  const groups = new Map<string, ProgressEntry[]>();
  for (const [id, e] of Object.entries(progress)) {
    const key = parentOf(id) ?? id;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const out: Progress = {};
  for (const [id, entries] of groups) {
    const [only] = entries;
    if (entries.length === 1 && only) {
      out[id] = only;
      continue;
    }
    const best = entries.reduce((a, b) => (RANK[b.state] > RANK[a.state] ? b : a));
    const solved = entries.filter(isSolved).length;
    const entry: ProgressEntry = {
      state: best.state,
      date: entries.map((e) => e.date).sort()[0] ?? best.date,
    };
    const last = latest(...entries.map((e) => e.last));
    const missed = latest(...entries.map((e) => e.missed));
    const misses = entries.reduce((n, e) => n + (e.misses ?? 0), 0);
    const reviews = entries.reduce((n, e) => n + (e.reviews ?? 0), 0) + Math.max(0, solved - 1);
    if (last !== undefined) entry.last = last;
    if (reviews > 0) entry.reviews = reviews;
    if (misses > 0) entry.misses = misses;
    if (missed !== undefined) entry.missed = missed;
    out[id] = entry;
  }
  return out;
}

export function mergeProgress(a: Progress, b: Progress): Progress {
  const out: Progress = { ...a };
  for (const [id, y] of Object.entries(b)) {
    const x = out[id];
    if (!x) {
      out[id] = y;
      continue;
    }
    const last = latest(x.last, y.last);
    const missed = latest(x.missed, y.missed);
    const entry: ProgressEntry = {
      state: RANK[y.state] > RANK[x.state] ? y.state : x.state,
      date: [x.date, y.date].sort()[0] ?? x.date,
    };
    if (last !== undefined) entry.last = last;
    if (x.reviews !== undefined || y.reviews !== undefined) {
      entry.reviews = Math.max(x.reviews ?? 0, y.reviews ?? 0);
    }
    if (x.misses !== undefined || y.misses !== undefined) {
      entry.misses = Math.max(x.misses ?? 0, y.misses ?? 0);
    }
    if (missed !== undefined) entry.missed = missed;
    out[id] = entry;
  }
  return out;
}

export function clearProgress(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Blocked storage holds nothing to clear.
  }
}
