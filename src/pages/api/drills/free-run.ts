// Why this exists: the one "10 random tasks" run a signed-in Free account gets
// each UTC day, as a taste of PRO function practice. The server picks the ten
// drills and keeps them in free_drill_runs, so pressing the button again the
// same day resumes the same ten, and /api/exercises/ can tell which drill
// answers a Free account may read. GET says whether today's run exists; POST
// creates it or returns it.
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { hasPro } from "../../../lib/access.ts";
import { freeRunSlugs } from "../../../lib/drills.ts";
import { json } from "../../../server/http.ts";
import { adminClient, currentUser } from "../../../server/supabase.ts";

export const prerender = false;

const profileOf = (supabase: Awaited<ReturnType<typeof currentUser>>["supabase"], id: string) =>
  supabase.from("profiles").select("pro_status, pro_until").eq("id", id).maybeSingle();

export const GET: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const { data: profile } = await profileOf(supabase, user.id);
  if (hasPro(profile)) return json({ pro: true, today: null });
  const { data } = await supabase
    .from("free_drill_runs")
    .select("slugs")
    .eq("user_id", user.id)
    .eq("day", new Date().toISOString().slice(0, 10))
    .maybeSingle();
  return json({ pro: false, today: (data?.slugs as string[] | undefined) ?? null });
};

export const POST: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const { data: profile } = await profileOf(supabase, user.id);
  if (hasPro(profile)) return json({ pro: true });
  const day = new Date().toISOString().slice(0, 10);
  const pool = (await getCollection("drills")).map((e) => ({
    id: e.data.id,
    slug: e.data.slug,
    fn: "",
    level: 0,
  }));
  // The row is kept as it is when it exists, so two tabs at once get the same ten.
  const db = adminClient();
  const { error } = await db
    .from("free_drill_runs")
    .upsert(
      { user_id: user.id, day, slugs: freeRunSlugs(pool) },
      { onConflict: "user_id,day", ignoreDuplicates: true },
    );
  if (error) return json({ error: "save failed" }, 500);
  const { data, error: readError } = await db
    .from("free_drill_runs")
    .select("slugs")
    .eq("user_id", user.id)
    .eq("day", day)
    .maybeSingle();
  if (readError || !data) return json({ error: "read failed" }, 500);
  return json({ slugs: data.slugs as string[] });
};
