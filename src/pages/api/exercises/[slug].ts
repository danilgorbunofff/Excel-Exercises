// Why this exists: hands the answers of a PRO exercise to a visitor with PRO,
// or to anyone on the Saturday it is the daily exercise (?day=YYYY-MM-DD).
// The static page leaves them out; see locked-exercise.ts and daily.ts.
import type { APIRoute } from "astro";
import { hasPro, isLocked } from "../../../lib/access.ts";
import { dailyPool, isDay, isProDay, pickFor } from "../../../lib/daily.ts";
import { placedExercises } from "../../../lib/exercises.ts";
import { addDays } from "../../../scripts/progress.ts";
import { json } from "../../../server/http.ts";
import { currentUser } from "../../../server/supabase.ts";

export const prerender = false;

/** True when the slug is the PRO daily of `day`, and `day` is today somewhere on Earth. */
function openAsDaily(
  day: string | null,
  slug: string,
  placed: Parameters<typeof dailyPool>[0],
): boolean {
  if (!isDay(day) || !isProDay(day)) return false;
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (day < addDays(todayUtc, -1) || day > addDays(todayUtc, 1)) return false;
  return pickFor(day, dailyPool(placed))?.slug === slug;
}

export const GET: APIRoute = async (ctx) => {
  const all = await placedExercises();
  const slug = ctx.params["slug"] ?? "";
  const placed = all.find((p) => p.exercise.slug === slug);
  if (!placed) return json({ error: "not found" }, 404);
  const answers = placed.exercise.screens.map((s) => s.answer);
  if (!isLocked(placed)) return json({ answers });
  if (openAsDaily(ctx.url.searchParams.get("day"), slug, all)) return json({ answers });

  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const { data: profile } = await supabase
    .from("profiles")
    .select("pro_status, pro_until")
    .eq("id", user.id)
    .maybeSingle();
  if (!hasPro(profile)) return json({ error: "PRO needed" }, 403);
  return json({ answers });
};
