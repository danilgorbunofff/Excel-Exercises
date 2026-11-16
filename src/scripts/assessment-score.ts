// Why this exists: marks a mock assessment. Kept apart from the page script so
// it can be tested without a browser.
import { type GradeSpec, grade, type Rule } from "@practice/grader";

export interface TaskData {
  exercise: string;
  screen: number;
  title: string;
  href: string;
  spec: GradeSpec;
  misses: Partial<Record<Rule, string>>;
  /** The exercise slug, to ask /api/exercises/ for a PRO answer. */
  slug: string;
  /** The reference answer, or null for a PRO exercise (fetched after Finish). */
  answer: string | null;
  /** The functions the task tests, for the score per function (skillsOf). */
  skills: string[];
}

/** Marks every task. A blank formula is a miss with no rule. */
export function scoreAttempt(formulas: readonly string[], tasks: readonly TaskData[]) {
  return tasks.map((task, i) => {
    const formula = (formulas[i] ?? "").trim();
    if (!formula) return { task, formula, verdict: null, correct: false, rule: null };
    const verdict = grade(formula, task.spec);
    return { task, formula, verdict, correct: verdict.correct, rule: verdict.rule };
  });
}

export interface FunctionScore {
  name: string;
  correct: number;
  total: number;
}

/**
 * Right answers per function, weakest first. A task counts once for each
 * function it tests; a task that tests none counts under "References".
 */
export function byFunction(
  results: readonly {
    correct: boolean;
    task: { skills: readonly string[] };
  }[],
): FunctionScore[] {
  const scores = new Map<string, FunctionScore>();
  for (const r of results) {
    const names = r.task.skills.length > 0 ? r.task.skills : ["References"];
    for (const name of names) {
      const s = scores.get(name) ?? { name, correct: 0, total: 0 };
      s.total += 1;
      if (r.correct) s.correct += 1;
      scores.set(name, s);
    }
  }
  return [...scores.values()].sort(
    (a, b) =>
      a.correct / a.total - b.correct / b.total ||
      b.total - a.total ||
      a.name.localeCompare(b.name),
  );
}
