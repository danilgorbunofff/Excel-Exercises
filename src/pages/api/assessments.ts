// Why this exists: keeps a signed-in user's mock assessment results. GET lists
// the latest attempts; POST saves one, after checking it matches its set and
// that a PRO set is taken with PRO.
import type { APIRoute } from "astro";
import { hasPro } from "../../lib/access.ts";
import { cleanAttempt, loadAssessments } from "../../lib/assessments.ts";
import { json } from "../../server/http.ts";
import { currentUser } from "../../server/supabase.ts";

export const prerender = false;

const MAX_BODY = 20_000;

export const GET: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select("assessment, started_at, finished_at, time_limit_s, score, total")
    .order("finished_at", { ascending: false })
    .limit(50);
  if (error) return json({ error: "read failed" }, 500);
  return json(data ?? []);
};

export const POST: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const text = await ctx.request.text().catch(() => "");
  if (text.length > MAX_BODY) return json({ error: "too large" }, 413);
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON: cleanAttempt rejects it below.
  }
  const sets = loadAssessments().sets;
  const attempt = cleanAttempt(body, sets);
  if (!attempt) return json({ error: "not a valid attempt" }, 400);
  if (!sets.find((s) => s.slug === attempt.assessment)?.sample) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pro_status, pro_until")
      .eq("id", user.id)
      .maybeSingle();
    if (!hasPro(profile)) return json({ error: "PRO needed" }, 403);
  }
  const { error } = await supabase.from("assessment_attempts").insert({
    user_id: user.id,
    assessment: attempt.assessment,
    started_at: attempt.startedAt,
    finished_at: attempt.finishedAt,
    time_limit_s: attempt.timeLimit,
    score: attempt.score,
    total: attempt.total,
    results: attempt.results,
  });
  if (error) return json({ error: "save failed" }, 500);
  return json({ saved: true }, 201);
};
