// Why this exists: progress lives in the browser only. Nothing is sent
// anywhere. Storage can be blocked or full, so every access is guarded and the
// page works without it. Solved exercises come back for review after growing
// gaps, so practice is spaced out over weeks.

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
