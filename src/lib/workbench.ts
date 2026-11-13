// Why this exists: the small pure pieces of the exercise page's timer and
// divider, so they are unit-tested.

/** The task panel stays between a quarter and two thirds of the width. */
export const PANE_MIN = 25;
export const PANE_MAX = 65;

export const clampPane = (pct: number) =>
  Math.min(PANE_MAX, Math.max(PANE_MIN, Number.isFinite(pct) ? pct : 40));

/** Milliseconds as hh:mm:ss. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
