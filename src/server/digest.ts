// Why this exists: the words of the weekly email. Pure, so they are
// unit-tested; the cron job reads the rows and sends them. The daily and
// starter emails are HTML, in mail-templates.ts.
import { addDays, isDue, isSolved, type Progress } from "../scripts/progress.ts";

export interface Digest {
  subject: string;
  text: string;
}

/** The weekly email, or null when there is nothing to say: no solves this week and nothing due. */
export function weeklyDigest(
  progress: Progress,
  today: string,
  links: { progress: string; unsubscribe: string },
): Digest | null {
  const weekAgo = addDays(today, -7);
  const entries = Object.values(progress);
  const solvedThisWeek = entries.filter((e) => isSolved(e) && (e.last ?? "") > weekAgo).length;
  const due = entries.filter((e) => isDue(e, today)).length;
  const missed = entries.filter((e) => !isSolved(e) && (e.misses ?? 0) > 0).length;
  if (solvedThisWeek === 0 && due === 0 && missed === 0) return null;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const lines = [
    solvedThisWeek > 0
      ? `This week you solved ${plural(solvedThisWeek, "exercise")}.`
      : "You did not solve an exercise this week.",
  ];
  if (due > 0)
    lines.push(
      `${plural(due, "exercise")} you solved before ${due === 1 ? "is" : "are"} due for review.`,
    );
  if (missed > 0)
    lines.push(
      `${plural(missed, "exercise")} you tried ${missed === 1 ? "is" : "are"} not solved yet.`,
    );
  lines.push("", `See your review list: ${links.progress}`);
  return {
    subject:
      due + missed > 0
        ? `${plural(due + missed, "exercise")} to review this week`
        : `You solved ${plural(solvedThisWeek, "exercise")} this week`,
    text: layout(
      lines,
      "You get this email because you turned on the weekly email in your account settings.",
      links.unsubscribe,
    ),
  };
}

/**
 * The frame every email shares: the body, then why it came and the
 * unsubscribe link. The one place to swap for an HTML template later.
 */
export const layout = (body: readonly string[], why: string, unsubscribe: string): string =>
  [...body, "", why, `Unsubscribe in one click: ${unsubscribe}`].join("\n");
