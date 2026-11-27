// Why this exists: hands the answers of a PRO exercise (or a step of one) or a function drill to a
// visitor with PRO, and those of a held-out mock task to one with PRO who has
// finished a set that holds it. The static pages leave them out; see locked-exercise.ts, and
// assessment.ts, which asks only once the attempt is saved.

import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { isLocked } from "../../../lib/access.ts";
import { loadAssessments } from "../../../lib/assessments.ts";
import { placedExercises, stepTasks } from "../../../lib/exercises.ts";
import { json } from "../../../server/http.ts";
import { hasPracticeAccess } from "../../../server/practice.ts";
import { currentUser } from "../../../server/supabase.ts";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const all = await placedExercises();
  const slug = ctx.params["slug"] ?? "";
  // A ladder step is placed where its exercise is, so it shares the exercise's lock.
  const placed =
    all.find((p) => p.exercise.slug === slug) ??
    (await stepTasks()).find((s) => s.exercise.slug === slug);
  const mock = placed
    ? undefined
    : (await getCollection("mocks")).find((e) => e.data.slug === slug);
  const drill =
    placed || mock ? undefined : (await getCollection("drills")).find((e) => e.data.slug === slug);
  if (!placed && !mock && !drill) return json({ error: "not found" }, 404);
  const answers =
    (placed?.exercise ?? mock?.data ?? drill?.data)?.screens.map((s) => s.answer) ?? [];
  if (placed && !isLocked(placed)) return json({ answers });

  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  // A Free account may read the answers of a drill in today's free run.
  if (!(await hasPracticeAccess(supabase, user.id, drill ? slug : null)))
    return json({ error: "PRO needed" }, 403);
  if (mock) {
    // A held-out task's answers come only after a set that holds it is finished
    // and saved, so a timed attempt cannot read them while it runs.
    const sets = loadAssessments()
      .sets.filter((s) => s.tasks.some((t) => t.exercise === mock.data.id))
      .map((s) => s.slug);
    const { data: done } = await supabase
      .from("assessment_attempts")
      .select("id")
      .eq("user_id", user.id)
      .in("assessment", sets)
      .limit(1);
    if (!done?.length) return json({ error: "finish the assessment first" }, 403);
  }
  return json({ answers });
};
