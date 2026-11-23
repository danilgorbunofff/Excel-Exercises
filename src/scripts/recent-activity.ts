// Why this exists: the Overview's "Recent activity" list, merged from the three
// records an account keeps: exercise progress, daily solves and mock
// assessment attempts. Pure, so it is tested without a browser.
import { addDays, type Progress } from "./progress.ts";

export interface ActivityRow {
  title: string;
  href: string | null;
  /** Where it happened: the track, "Daily exercise" or "Mock assessment". */
  where: string;
  result: string;
  /** YYYY-MM-DD. */
  day: string;
  good: boolean;
}

export interface ActivityInput {
  progress: Progress;
  exercises: ReadonlyMap<string, { title: string; href: string; trackTitle: string }>;
  daily: Readonly<Record<string, string>>;
  dailyTitles: Readonly<Record<string, string>>;
  attempts: readonly { assessment: string; finished_at: string; score: number; total: number }[];
  setTitles: Readonly<Record<string, string>>;
}

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** The latest things done, newest first: one row per exercise, daily day and attempt. */
export function recentActivity(input: ActivityInput, limit = 6): ActivityRow[] {
  const rows: (ActivityRow & { rank: number })[] = [];
  for (const [id, e] of Object.entries(input.progress)) {
    const ex = input.exercises.get(id);
    if (!ex) continue;
    const solved = e.state === "solved" || e.state === "helped";
    const missedLast = e.missed && (!e.last || e.missed > e.last);
    const [result, day, good] = missedLast
      ? ["Wrong answer", e.missed as string, false]
      : solved
        ? [e.state === "helped" ? "Solved with a hint" : "Solved", e.last ?? e.date, true]
        : [e.state === "revealed" ? "Answer shown" : "Tried", e.date, false];
    rows.push({ title: ex.title, href: ex.href, where: ex.trackTitle, result, day, good, rank: 1 });
  }
  for (const [day, id] of Object.entries(input.daily)) {
    rows.push({
      title: input.dailyTitles[id] ?? "Daily exercise",
      href: null,
      where: "Daily exercise",
      result: "Solved",
      day,
      good: true,
      rank: 2,
    });
  }
  for (const a of input.attempts) {
    const pct = Math.round((a.score / a.total) * 100);
    rows.push({
      title: input.setTitles[a.assessment] ?? "Mock assessment",
      href: null,
      where: "Mock assessment",
      result: `${a.score} of ${a.total}, ${pct}%`,
      day: localDay(a.finished_at),
      good: pct >= 80,
      rank: 0,
    });
  }
  return rows
    .sort((a, b) => (a.day === b.day ? a.rank - b.rank : a.day < b.day ? 1 : -1))
    .slice(0, limit)
    .map(({ rank: _, ...row }) => row);
}

/** "Today", "Yesterday" or "20 Nov". */
export function dayLabel(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
