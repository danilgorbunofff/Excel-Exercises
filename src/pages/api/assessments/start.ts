// Why this exists: stamps the start of a mock assessment on the server. The
// browser sends the token back with the finished attempt, so the time a
// certificate rests on is measured by the server, not the browser's clock.
import type { APIRoute } from "astro";
import { loadAssessments } from "../../../lib/assessments.ts";
import { env } from "../../../server/env.ts";
import { json } from "../../../server/http.ts";
import { startToken } from "../../../server/start-token.ts";
import { currentUser } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const { user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const body = (await ctx.request.json().catch(() => null)) as { assessment?: unknown } | null;
  const set = loadAssessments().sets.find((s) => s.slug === body?.assessment);
  if (!set) return json({ error: "unknown assessment" }, 400);
  return json({ token: startToken(env.assessmentStartKey(), user.id, set.slug) });
};
