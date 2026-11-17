// Why this exists: the catalogue's filter and sort, kept pure so they are
// unit-tested. The script reads rows from the table and passes them here.

export interface CatalogueRow {
  /** Position in the one track order, 1-based. */
  order: number;
  title: string;
  level: number;
  track: string;
  /** Lower-case words to match: title and function names. */
  search: string;
  /** The functions the exercise requires, such as "SUMIF". */
  functions: readonly string[];
  /** "solved", "helped", "revealed", "tried" or "" when not started. */
  state: string;
}

export interface CatalogueFilter {
  q: string;
  /** One function name. It must match a whole name, so OR does not find "score". */
  fn: string;
  level: string;
  track: string;
  progress: "" | "done" | "todo";
}

export type SortKey = "order" | "title" | "level" | "state";
export type SortDir = "ascending" | "descending";

export const isDone = (state: string) => state === "solved" || state === "helped";

export function matches(row: CatalogueRow, f: CatalogueFilter): boolean {
  const words = f.q.toLowerCase().split(/\s+/u).filter(Boolean);
  if (!words.every((w) => row.search.includes(w))) return false;
  if (f.fn && !row.functions.includes(f.fn.toUpperCase())) return false;
  if (f.level && String(row.level) !== f.level) return false;
  if (f.track && row.track !== f.track) return false;
  if (f.progress === "done" && !isDone(row.state)) return false;
  if (f.progress === "todo" && isDone(row.state)) return false;
  return true;
}

/** A track card's pill and button, from how many of its exercises are done. */
export function trackStatus(done: number, total: number) {
  if (total > 0 && done >= total) {
    return { state: "done", pill: "Completed", action: "Review track" } as const;
  }
  if (done > 0) return { state: "doing", pill: "In progress", action: "Continue track" } as const;
  return { state: "todo", pill: "Not started", action: "Start track" } as const;
}

/** The button beside one exercise in a track. */
export const exerciseAction = (state: string) => (isDone(state) ? "Review" : "Start");

const STATE_RANK: Record<string, number> = { solved: 0, helped: 1, revealed: 2, tried: 3, "": 4 };

export function compare(a: CatalogueRow, b: CatalogueRow, key: SortKey, dir: SortDir): number {
  let d: number;
  if (key === "title") d = a.title.localeCompare(b.title, "en");
  else if (key === "level") d = a.level - b.level;
  else if (key === "state") d = (STATE_RANK[a.state] ?? 4) - (STATE_RANK[b.state] ?? 4);
  else d = a.order - b.order;
  if (d === 0) d = a.order - b.order;
  return dir === "descending" ? -d : d;
}

export function countLine(shown: number, total: number, filtered: boolean): string {
  if (!filtered) return "";
  if (shown === 0) return "No exercise matches. Try a function name such as SUM.";
  return `Showing ${shown} of ${total} exercises.`;
}
