// Why this exists: which drills a session plays, in which order. Pure, so it is
// unit-tested; drills.ts reads the choice from the page address.

export interface DrillRef {
  id: string;
  slug: string;
  fn: string;
  level: number;
  title?: string;
}

/** Drills in a "random" session. */
export const RANDOM_SIZE = 10;

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** The slugs of a "random" session: the ten a Free account runs once a day. */
export const freeRunSlugs = (pool: readonly DrillRef[], random: () => number = Math.random) =>
  drillQueue(pool, { fns: ["random"], id: null }, random).map((d) => d.slug);

/**
 * Where a drill page sits in its session: its place, and the slugs before and
 * after it. index is -1 when the page is not in the session.
 */
export function sessionStep(
  slugs: readonly string[],
  slug: string,
): { index: number; prev: string | null; next: string | null } {
  const index = slugs.indexOf(slug);
  if (index < 0) return { index, prev: null, next: null };
  return { index, prev: slugs[index - 1] ?? null, next: slugs[index + 1] ?? null };
}

/**
 * The queue for a choice from the page address: one drill by id, every drill
 * shuffled ("all"), ten at random ("random"), or the drills of the chosen
 * functions, each function from easy to hard, in the order they were chosen.
 * The pool comes sorted by function, then level.
 */
export function drillQueue(
  pool: readonly DrillRef[],
  choice: { fns: readonly string[]; id: string | null },
  random: () => number = Math.random,
): DrillRef[] {
  if (choice.id) return pool.filter((d) => d.id === choice.id);
  if (choice.fns.includes("all")) return shuffle(pool, random);
  if (choice.fns.includes("random")) return shuffle(pool, random).slice(0, RANDOM_SIZE);
  return [...new Set(choice.fns)].flatMap((fn) => pool.filter((d) => d.fn === fn));
}
