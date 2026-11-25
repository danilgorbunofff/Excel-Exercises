// Why this exists: each track exercise is one step of a five-step ladder on the
// same theme, easiest (1) to hardest (5). The other four steps live in
// content/steps/ as <parent id>-step-<n>. Solving any step counts as solving
// the exercise. Pure, so the pages, the browser scripts and the validator share it.

export const LADDER_SIZE = 5;

export interface Rung {
  id: string;
  step: number;
  href: string;
}

const STEP_ID = /^(.+)-step-([1-5])$/u;

export const stepId = (parent: string, step: number) => `${parent}-step-${step}`;

/** The track exercise a step id belongs to, or null for any other id. */
export const parentOf = (id: string): string | null => STEP_ID.exec(id)?.[1] ?? null;

/** The step address: /exercises/<parent slug>/<step>/. */
export const stepPath = (parentSlug: string, step: number) => `/exercises/${parentSlug}/${step}/`;

/** The step the exercise itself fills: the one number in 1 to 5 no step file covers. */
export function originalSlot(steps: readonly number[]): number | null {
  const free = [1, 2, 3, 4, 5].filter((n) => !steps.includes(n));
  return steps.length === LADDER_SIZE - 1 && free.length === 1 ? (free[0] ?? null) : null;
}

/**
 * The step to practise when the exercise comes back for review: the first
 * unsolved step above the hardest one solved, else the nearest unsolved one
 * below it, else the step solved longest ago. lastSolved gives a step's latest
 * solve day, if any. The ladder is in step order.
 */
export function reviewStep(
  ladder: readonly Rung[],
  lastSolved: (id: string) => string | undefined,
): Rung | null {
  const solved = ladder.filter((r) => lastSolved(r.id) !== undefined);
  const top = Math.max(0, ...solved.map((r) => r.step));
  const open = ladder.filter((r) => lastSolved(r.id) === undefined);
  return (
    open.find((r) => r.step > top) ??
    open.filter((r) => r.step < top).at(-1) ??
    [...solved].sort((a, b) => (lastSolved(a.id) ?? "").localeCompare(lastSolved(b.id) ?? ""))[0] ??
    null
  );
}
