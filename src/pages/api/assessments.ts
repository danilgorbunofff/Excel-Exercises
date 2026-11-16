// Why this exists: keeps a signed-in user's mock assessment results. GET lists
// the latest attempts; POST marks the typed formulas on the server, checks the
// set matches and that a PRO set is taken with PRO, and saves the attempt with
// the service role, stamped with the server's start and receipt times.
import type { APIRoute } from "astro";
import { hasPro } from "../../lib/access.ts";
import { cleanAttempt, loadAssessments } from "../../lib/assessments.ts";
import { loadSpecs } from "../../server/assessment-specs.ts";
import { env } from "../../server/env.ts";
import { json } from "../../server/http.ts";
import { readStartToken } from "../../server/start-token.ts";
import { adminClient, currentUser } from "../../server/supabase.ts";

export const prerender = false;

const MAX_BODY = 60_000;

export const GET: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select("id, assessment, started_at, finished_at, time_limit_s, score, total")
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
  const attempt = cleanAttempt(body, sets, await loadSpecs());
  if (!attempt) return json({ error: "not a valid attempt" }, 400);
  if (!sets.find((s) => s.slug === attempt.assessment)?.sample) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pro_status, pro_until")
      .eq("id", user.id)
      .maybeSingle();
    if (!hasPro(profile)) return json({ error: "PRO needed" }, 403);
  }
  const now = Date.now();
  const start =
    attempt.timeLimit === null
      ? null
      : readStartToken(
          env.assessmentStartKey(),
          user.id,
          attempt.assessment,
          attempt.startToken,
          now,
        );
  const { data, error } = await adminClient()
    .from("assessment_attempts")
    .insert({
      user_id: user.id,
      assessment: attempt.assessment,
      started_at: attempt.startedAt,
      finished_at: attempt.finishedAt,
      time_limit_s: attempt.timeLimit,
      score: attempt.score,
      total: attempt.total,
      results: attempt.results,
      formulas: attempt.formulas,
      server_started_at: start === null ? null : new Date(start).toISOString(),
      received_at: new Date(now).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return json({ error: "save failed" }, 500);
  return json(
    {
      saved: true,
      id: data.id,
      score: attempt.score,
      total: attempt.total,
      results: attempt.results,
    },
    201,
  );
};
