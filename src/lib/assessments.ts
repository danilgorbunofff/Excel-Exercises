// Why this exists: the mock assessment sets, checked against the exercises,
// and the rules for an attempt. The pages, the API and the content validator
// share it, so a set cannot pass one and fail another.
import { readFileSync } from "node:fs";
import { type GradeSpec, grade } from "@practice/grader";
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
  /** Needs PRO (isLocked). */
  locked: boolean;
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
      else if (set.sample && ex.locked)
        problems.push(`${set.slug}: the free sample uses PRO exercise "${task.exercise}"`);
      if (seen.has(key)) problems.push(`${set.slug}: "${key}" appears twice`);
      seen.add(key);
    }
  }
  if (!data.sets.some((s) => s.sample)) problems.push("there is no free sample set");
  return problems;
}

/** One graded task in an attempt, as the server marked it. */
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
  /** The formula typed for each task, in task order; "" when left blank. */
  formulas: string[];
  /** The token from /api/assessments/start/, or null when the browser has none. */
  startToken: string | null;
}

/** The grading spec of one exercise screen, or null when there is no such screen. */
export type SpecFor = (exercise: string, screen: number) => GradeSpec | null;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const MAX_FORMULA = 2000;
const TOKEN = /^\d{13}\.[A-Za-z0-9_-]{43}$/u;

/**
 * Marks each formula against its task with the grader. The browser's own
 * marks are never read: this is the score that is stored and certified.
 */
export function gradeAttempt(
  set: AssessmentSet,
  formulas: readonly string[],
  specFor: SpecFor,
): { score: number; total: number; results: TaskResult[] } | null {
  const results: TaskResult[] = [];
  for (const [i, task] of set.tasks.entries()) {
    const spec = specFor(task.exercise, task.screen);
    if (!spec) return null;
    const formula = (formulas[i] ?? "").trim();
    const verdict = formula ? grade(formula, spec) : null;
    results.push({
      exercise: task.exercise,
      screen: task.screen,
      correct: verdict?.correct ?? false,
      rule: verdict?.rule ?? null,
    });
  }
  return { score: results.filter((r) => r.correct).length, total: results.length, results };
}

/**
 * The attempt, if it matches its set exactly, marked here on the server;
 * otherwise null.
 */
export function cleanAttempt(
  body: unknown,
  sets: readonly AssessmentSet[],
  specFor: SpecFor,
): Attempt | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const set = sets.find((s) => s.slug === b["assessment"]);
  const raw = b["formulas"];
  if (!set || !Array.isArray(raw) || raw.length !== set.tasks.length) return null;
  if (!raw.every((f) => typeof f === "string" && f.length <= MAX_FORMULA)) return null;
  const formulas = (raw as string[]).map((f) => f.trim());
  const startedAt = String(b["startedAt"]);
  const finishedAt = String(b["finishedAt"]);
  if (!ISO.test(startedAt) || !ISO.test(finishedAt) || finishedAt < startedAt) return null;
  const limit = b["timeLimit"];
  if (limit !== null && !(Number.isInteger(limit) && limit === set.minutes * 60)) return null;
  const token = b["startToken"];
  const graded = gradeAttempt(set, formulas, specFor);
  if (!graded) return null;
  return {
    assessment: set.slug,
    startedAt,
    finishedAt,
    timeLimit: limit as number | null,
    ...graded,
    formulas,
    startToken: typeof token === "string" && TOKEN.test(token) ? token : null,
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
