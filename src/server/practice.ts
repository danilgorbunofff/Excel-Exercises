// Why this exists: what the server needs to mark a practice solve itself, for
// points. Every task that can be solved on the site (a track exercise, a
// ladder step, a function drill, a daily exercise) by id, with its grading
// specs and lock, and the one access check that the answers endpoint and the
// solve endpoint share.
import { getCollection } from "astro:content";
import type { GradeSpec } from "@practice/grader";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPro, isLocked } from "../lib/access.ts";
import { dailyTasks, exerciseData, placedExercises, stepTasks } from "../lib/exercises.ts";
import type { TaskKind } from "../lib/points.ts";

export interface PracticeTask {
  id: string;
  slug: string;
  kind: TaskKind;
  /** The points ledger item: a ladder step counts as its track exercise. */
  item: string;
  level: number;
  /** Needs PRO, or for a drill, PRO or today's free run. */
  locked: boolean;
  specs: GradeSpec[];
}

let cache: Map<string, PracticeTask> | null = null;

export async function practiceTask(id: string): Promise<PracticeTask | null> {
  if (!cache) {
    const specs = (e: Parameters<typeof exerciseData>[0]) =>
      exerciseData(e).screens.map((s) => s.spec);
    const tasks: PracticeTask[] = [
      ...(await placedExercises()).map((p) => ({
        id: p.exercise.id,
        slug: p.exercise.slug,
        kind: "exercise" as const,
        item: p.exercise.id,
        level: p.exercise.level,
        locked: isLocked(p),
        specs: specs(p.exercise),
      })),
      ...(await stepTasks()).map((s) => ({
        id: s.exercise.id,
        slug: s.exercise.slug,
        kind: "exercise" as const,
        item: s.parent.exercise.id,
        level: s.parent.exercise.level,
        locked: isLocked(s),
        specs: specs(s.exercise),
      })),
      ...(await getCollection("drills")).map(({ data }) => ({
        id: data.id,
        slug: data.slug,
        kind: "drill" as const,
        item: data.id,
        level: data.level,
        locked: true,
        specs: specs(data),
      })),
      ...(await dailyTasks()).map((t) => ({
        id: t.exercise.id,
        slug: t.exercise.slug,
        kind: "daily" as const,
        item: t.exercise.id,
        level: t.exercise.level,
        locked: false,
        specs: specs(t.exercise),
      })),
    ];
    cache = new Map(tasks.map((t) => [t.id, t]));
  }
  return cache.get(id) ?? null;
}

/**
 * True when the account may practise locked content: it has PRO, or, for a
 * drill, the drill is in today's free run.
 */
export async function hasPracticeAccess(
  supabase: SupabaseClient,
  userId: string,
  drillSlug: string | null,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("pro_status, pro_until")
    .eq("id", userId)
    .maybeSingle();
  if (hasPro(profile)) return true;
  if (!drillSlug) return false;
  const { data: run } = await supabase
    .from("free_drill_runs")
    .select("day")
    .eq("user_id", userId)
    .eq("day", new Date().toISOString().slice(0, 10))
    .contains("slugs", [drillSlug])
    .maybeSingle();
  return Boolean(run);
}
