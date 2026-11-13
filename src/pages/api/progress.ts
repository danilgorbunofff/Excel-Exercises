// Why this exists: keeps a copy of the browser's progress in the account, so
// it follows the user to other devices. The browser merges before it sends.
import type { APIRoute } from "astro";
import type { Progress, ProgressEntry } from "../../scripts/progress.ts";
import { json } from "../../server/http.ts";
import { currentUser } from "../../server/supabase.ts";

export const prerender = false;

const STATES = new Set(["revealed", "solved", "helped"]);
const DAY = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_ENTRIES = 2000;

/** Keeps only well-formed entries; anything else from the browser is dropped. */
function clean(body: unknown): Progress {
  const out: Progress = {};
  if (!body || typeof body !== "object") return out;
  for (const [id, raw] of Object.entries(body).slice(0, MAX_ENTRIES)) {
    const e = raw as Partial<ProgressEntry>;
    if (id.length > 120 || !STATES.has(String(e?.state)) || !DAY.test(String(e?.date))) continue;
    const entry: ProgressEntry = { state: e.state as ProgressEntry["state"], date: String(e.date) };
    if (e.last !== undefined && DAY.test(String(e.last))) entry.last = String(e.last);
    if (Number.isInteger(e.reviews) && (e.reviews ?? 0) >= 0) entry.reviews = Number(e.reviews);
    out[id] = entry;
  }
  return out;
}

export const GET: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const { data, error } = await supabase.from("progress").select("exercise_id, entry");
  if (error) return json({ error: "read failed" }, 500);
  return json(Object.fromEntries((data ?? []).map((r) => [r.exercise_id, r.entry])));
};

export const PUT: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const progress = clean(await ctx.request.json().catch(() => null));
  const rows = Object.entries(progress).map(([exercise_id, entry]) => ({
    user_id: user.id,
    exercise_id,
    entry,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from("progress").upsert(rows);
    if (error) return json({ error: "save failed" }, 500);
  }
  return json({ saved: rows.length });
};
