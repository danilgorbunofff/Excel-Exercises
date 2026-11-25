// Why this exists: the profile page's numbers, counted from progress without
// the DOM, so they can be tested: totals, per difficulty, per track, the
// next exercise and practice days.
import {
  activeDays,
  foldSets,
  isSolved,
  localDay,
  needsReview,
  type Progress,
} from "./progress.ts";

export interface ProfileItem {
  id: string;
  title: string;
  href: string;
  level: number;
  track: string;
}

export interface Tally {
  solved: number;
  total: number;
}

export interface ProfileStats {
  solved: number;
  helped: number;
  /** Missed and not solved since, or solved and due again, as on /progress/. */
  due: number;
  /** Whole percent of exercises solved. */
  percent: number;
  levels: Map<number, Tally>;
  tracks: Map<string, Tally>;
  /** The first unsolved exercise in track order, or null when all are solved. */
  next: ProfileItem | null;
  days: number;
  /** The latest day with any practice, YYYY-MM-DD, or null. */
  last: string | null;
}

const bump = <K>(map: Map<K, Tally>, key: K, solved: boolean) => {
  const t = map.get(key) ?? { solved: 0, total: 0 };
  t.total += 1;
  if (solved) t.solved += 1;
  map.set(key, t);
};

/** dailyDays: the days a daily exercise was solved, counted as practice too. */
export function profileStats(
  items: readonly ProfileItem[],
  progress: Progress,
  dailyDays: Iterable<string> = [],
  today = localDay(),
): ProfileStats {
  const levels = new Map<number, Tally>();
  const tracks = new Map<string, Tally>();
  let solved = 0;
  let helped = 0;
  let due = 0;
  let next: ProfileItem | null = null;
  // By exercise, so a solved ladder step counts; the practice days below keep every task.
  const sets = foldSets(progress);
  for (const item of items) {
    const entry = sets[item.id];
    const done = isSolved(entry);
    if (done) solved += 1;
    if (entry?.state === "helped") helped += 1;
    if (needsReview(entry, today)) due += 1;
    if (!done && !next) next = item;
    bump(levels, item.level, done);
    bump(tracks, item.track, done);
  }
  const days = [...activeDays(progress, dailyDays).keys()].filter((d) => d <= today).sort();
  return {
    solved,
    helped,
    due,
    percent: items.length ? Math.floor((solved / items.length) * 100) : 0,
    levels,
    tracks,
    next,
    days: days.length,
    last: days.at(-1) ?? null,
  };
}
