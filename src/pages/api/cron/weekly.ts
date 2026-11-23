// Why this exists: Vercel runs it every Monday (vercel.json crons). It sends
// the weekly email to each person who turned it on, and deletes usage events
// older than 13 months, as the privacy page promises.
import type { APIRoute } from "astro";
import { localDay, type Progress } from "../../../scripts/progress.ts";
import { weeklyDigest } from "../../../server/digest.ts";
import { sendMail, unsubscribeToken } from "../../../server/email.ts";
import { env } from "../../../server/env.ts";
import { json } from "../../../server/http.ts";
import { adminClient } from "../../../server/supabase.ts";

export const prerender = false;

// shortcut: one run handles up to 1000 people in one go; page through them, or queue, past that.
const MAX_PEOPLE = 1000;
const KEEP_EVENTS_DAYS = 396;

export const GET: APIRoute = async ({ request, url }) => {
  if (request.headers.get("authorization") !== `Bearer ${env.cronSecret()}`)
    return json({ error: "forbidden" }, 401);
  const db = adminClient();
  const cutoff = new Date(Date.now() - KEEP_EVENTS_DAYS * 86_400_000).toISOString();
  await db.from("events").delete().lt("created_at", cutoff);

  const { data: people } = await db
    .from("profiles")
    .select("id")
    .eq("digest", true)
    .limit(MAX_PEOPLE);
  const today = localDay();
  let sent = 0;
  for (const { id } of people ?? []) {
    const [{ data: user }, { data: rows }] = await Promise.all([
      db.auth.admin.getUserById(id),
      db.from("progress").select("exercise_id, entry").eq("user_id", id),
    ]);
    const email = user?.user?.email;
    if (!email) continue;
    const progress: Progress = Object.fromEntries(
      (rows ?? []).map((r) => [r.exercise_id, r.entry]),
    );
    const unsubscribe = `${url.origin}/api/email/unsubscribe/?t=${unsubscribeToken(env.unsubscribeKey(), id)}`;
    const digest = weeklyDigest(progress, today, {
      progress: `${url.origin}/account/progress/`,
      unsubscribe,
    });
    if (digest && (await sendMail({ to: email, ...digest, unsubscribe }))) sent += 1;
  }
  return json({ people: people?.length ?? 0, sent });
};
