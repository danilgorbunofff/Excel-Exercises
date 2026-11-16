// Why this exists: keeps the days a signed-in user solved the daily exercise,
// so the streak follows them to other devices. GET lists the days; POST adds
// days, after checking each one is real, not in the future and holds that
// day's exercise. The browser merges before it sends.
import type { APIRoute } from "astro";
import { cleanDailySolves, dailyPool } from "../../lib/daily.ts";
import { placedExercises } from "../../lib/exercises.ts";
import { json } from "../../server/http.ts";
import { currentUser } from "../../server/supabase.ts";

export const prerender = false;

const MAX_BODY = 40_000;

export const GET: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const { data, error } = await supabase
    .from("daily_solves")
    .select("day, exercise")
    .order("day", { ascending: false })
    .limit(1000);
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
    // Not JSON: cleanDailySolves rejects it below.
  }
  const todayUtc = new Date().toISOString().slice(0, 10);
  const solves = cleanDailySolves(body, dailyPool(await placedExercises()), todayUtc);
  if (!solves) return json({ error: "not valid daily solves" }, 400);
  // A day already saved, from this or another device, is left as it is.
  const { error } = await supabase.from("daily_solves").upsert(
    solves.map((s) => ({ user_id: user.id, day: s.day, exercise: s.exercise })),
    { onConflict: "user_id,day", ignoreDuplicates: true },
  );
  if (error) return json({ error: "save failed" }, 500);
  return json({ saved: solves.length }, 201);
};
