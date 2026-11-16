// Why this exists: the days this browser solved the daily exercise, kept in
// local storage like practice progress. Storage can be blocked or full, so
// every access is guarded and the page works without it.

/** Each solved day, YYYY-MM-DD in local time, with that day's exercise id. */
export type DailyDays = Record<string, string>;

export const DAILY_KEY = "formula-practice:daily:v1";

export function readDaily(storage: Storage | undefined = globalThis.localStorage): DailyDays {
  try {
    const raw = storage?.getItem(DAILY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => typeof v === "string"),
    ) as DailyDays;
  } catch {
    return {};
  }
}

export function writeDaily(
  days: DailyDays,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(DAILY_KEY, JSON.stringify(days));
  } catch {
    // Storage is blocked or full: the streak shows for this visit only.
  }
}
