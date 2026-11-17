// Why this exists: which drills a session plays, in which order. Pure, so it is
// unit-tested; drills.ts reads the choice from the page address.

export interface DrillRef {
  id: string;
  slug: string;
  fn: string;
  level: number;
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
