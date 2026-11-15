// Why this exists: the mock assessment sets, checked against the exercises,
// and the rules for an attempt. The pages, the API and the content validator
// share it, so a set cannot pass one and fail another.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { type AssessmentSet, type Assessments, assessmentsSchema } from "../content/schema.ts";

export type { AssessmentSet };

export const assessmentPath = (slug: string) => `/mock-assessments/${slug}/`;

let cache: Assessments | null = null;
/** The sets in content/assessments.yaml. The API reads it at run time too. */
export function loadAssessments(): Assessments {
  cache ??= assessmentsSchema.parse(parse(readFileSync("content/assessments.yaml", "utf8")));
  return cache;
}

/** What the checks need to know about an exercise. */
export interface ExerciseFacts {
  id: string;
  pro: boolean;
  screens: number;
}

/** Problems with the sets, one line each. Empty means valid. */
export function checkAssessments(data: Assessments, exercises: readonly ExerciseFacts[]): string[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const problems: string[] = [];
  const slugs = new Set<string>();
  for (const set of data.sets) {
    if (slugs.has(set.slug)) problems.push(`${set.slug}: the slug is used twice`);
    slugs.add(set.slug);
    const seen = new Set<string>();
    for (const task of set.tasks) {
      const ex = byId.get(task.exercise);
      const key = `${task.exercise}#${task.screen}`;
      if (!ex) problems.push(`${set.slug}: no exercise "${task.exercise}"`);
      else if (task.screen >= ex.screens)
        problems.push(`${set.slug}: "${task.exercise}" has no screen ${task.screen}`);
      else if (set.sample && ex.pro)
        problems.push(`${set.slug}: the free sample uses PRO exercise "${task.exercise}"`);
      if (seen.has(key)) problems.push(`${set.slug}: "${key}" appears twice`);
      seen.add(key);
    }
  }
  if (!data.sets.some((s) => s.sample)) problems.push("there is no free sample set");
  return problems;
}

/** One graded task in an attempt, as the browser reports it. */
export interface TaskResult {
  exercise: string;
  screen: number;
  correct: boolean;
  /** The rule that failed, or null when correct or left blank. */
  rule: string | null;
}

export interface Attempt {
  assessment: string;
  startedAt: string;
  finishedAt: string;
  /** Seconds, or null when the visitor turned the limit off. */
  timeLimit: number | null;
  score: number;
  total: number;
  results: TaskResult[];
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const RULE = /^[a-z-]{1,40}$/u;

/**
 * The attempt, if it matches its set exactly; otherwise null. The score is
 * recounted here rather than trusted.
 * shortcut: grading runs in the browser, so a visitor can still report a
 * formula as correct when it was not. It only changes their own history; grade
 * on the server if scores are ever shown to anyone else.
 */
export function cleanAttempt(body: unknown, sets: readonly AssessmentSet[]): Attempt | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const set = sets.find((s) => s.slug === b["assessment"]);
  if (!set || !Array.isArray(b["results"]) || b["results"].length !== set.tasks.length) return null;
  const startedAt = String(b["startedAt"]);
  const finishedAt = String(b["finishedAt"]);
  if (!ISO.test(startedAt) || !ISO.test(finishedAt) || finishedAt < startedAt) return null;
  const limit = b["timeLimit"];
  if (limit !== null && !(Number.isInteger(limit) && limit === set.minutes * 60)) return null;
  const results: TaskResult[] = [];
  for (const [i, raw] of (b["results"] as unknown[]).entries()) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const task = set.tasks[i];
    if (!task || r["exercise"] !== task.exercise || r["screen"] !== task.screen) return null;
    if (typeof r["correct"] !== "boolean") return null;
    const rule = r["correct"] || r["rule"] === null ? null : String(r["rule"]);
    if (rule !== null && !RULE.test(rule)) return null;
    results.push({ exercise: task.exercise, screen: task.screen, correct: r["correct"], rule });
  }
  return {
    assessment: set.slug,
    startedAt,
    finishedAt,
    timeLimit: limit as number | null,
    score: results.filter((r) => r.correct).length,
    total: results.length,
    results,
  };
}

/** What the cover of a set needs about each exercise. */
export interface CoverFacts {
  level: number;
  screens: readonly { requiredFunctions: readonly string[] }[];
}

/** What a set covers: each task's functions and level, and the set's totals. */
export function coverOf(set: AssessmentSet, byId: ReadonlyMap<string, CoverFacts>) {
  const tasks = set.tasks.map((t) => {
    const ex = byId.get(t.exercise);
    return {
      functions: [...(ex?.screens[t.screen]?.requiredFunctions ?? [])],
      level: ex?.level ?? 1,
    };
  });
  const levels = [...new Set(tasks.map((t) => t.level))].sort((a, b) => a - b);
  return {
    tasks,
    functions: [...new Set(tasks.flatMap((t) => t.functions))],
    levels,
  };
}
