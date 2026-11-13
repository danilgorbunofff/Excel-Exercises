// Why this exists: hands the answers of a PRO exercise to a visitor with PRO.
// The static page leaves them out; see locked-exercise.ts.
import type { APIRoute } from "astro";
import { hasPro, isLocked } from "../../../lib/access.ts";
import { placedExercises } from "../../../lib/exercises.ts";
import { json } from "../../../server/http.ts";
import { currentUser } from "../../../server/supabase.ts";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const placed = (await placedExercises()).find((p) => p.exercise.slug === ctx.params["slug"]);
  if (!placed) return json({ error: "not found" }, 404);
  const answers = placed.exercise.screens.map((s) => s.answer);
  if (!isLocked(placed)) return json({ answers });

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
