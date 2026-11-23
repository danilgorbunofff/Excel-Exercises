// Why this exists: Vercel runs it every day at 12:00 UTC (vercel.json crons),
// when the UTC date is the same calendar date from UTC-11 to UTC+11, so the
// task it mails is the one /daily/ shows. Each person who turned the daily
// email on gets one email a day: a starter email on its day (mailFor), else
// the daily exercise. A mail_log row is written before each send, so a retried
// or doubled run never mails anyone twice.
import type { APIRoute } from "astro";
import { siteConfig } from "../../../../site.config.ts";
import { hasPro } from "../../../lib/access.ts";
import type { TaskResult } from "../../../lib/assessments.ts";
import { currentStreak, ladderPool, pickFor } from "../../../lib/daily.ts";
import { dailyTasks } from "../../../lib/exercises.ts";
import { byFunction } from "../../../scripts/assessment-score.ts";
import { isSolved, type ProgressEntry } from "../../../scripts/progress.ts";
import { loadSkills } from "../../../server/assessment-specs.ts";
import { sendMail, unsubscribeToken } from "../../../server/email.ts";
import { env } from "../../../server/env.ts";
import { json } from "../../../server/http.ts";
import {
  dailyMail,
  type Email,
  employerTestMail,
  levelMail,
  type MailContext,
  mailFor,
  offerMail,
  type StarterKind,
  tipMail,
  weekMail,
  welcomeMail,
} from "../../../server/mail-templates.ts";
import { adminClient } from "../../../server/supabase.ts";

export const prerender = false;

// shortcut: one run handles up to 1000 people in one go; page through them, or queue, past that.
const MAX_PEOPLE = 1000;

type Db = ReturnType<typeof adminClient>;

/** Builds one person's email, reading only the rows that email needs. */
async function build(
  kind: StarterKind,
  ctx: MailContext,
  db: Db,
  id: string,
  day: string,
): Promise<Email> {
  switch (kind) {
    case "welcome":
      return welcomeMail(ctx);
    case "level": {
      const { data } = await db
        .from("assessment_attempts")
        .select("score, total, results")
        .eq("user_id", id)
        .eq("assessment", "sample")
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return levelMail(ctx, null);
      const skillsFor = await loadSkills();
      const results = data.results as TaskResult[];
      return levelMail(ctx, {
        score: data.score,
        total: data.total,
        skills: byFunction(
          results.map((r) => ({
            correct: r.correct,
            task: { skills: skillsFor(r.exercise, r.screen) },
          })),
        ),
      });
    }
    case "tip":
      return tipMail(ctx);
    case "week": {
      const [{ data: rows }, { data: days }] = await Promise.all([
        db.from("progress").select("entry").eq("user_id", id),
        db.from("daily_solves").select("day").eq("user_id", id),
      ]);
      return weekMail(ctx, {
        solved: (rows ?? []).filter((r: { entry: ProgressEntry }) => isSolved(r.entry)).length,
        streak: currentStreak(new Set((days ?? []).map((d: { day: string }) => d.day)), day),
      });
    }
    case "employer":
      return employerTestMail(ctx);
    case "offer":
      return offerMail(ctx, siteConfig.lifetimeOffer);
    case "daily":
      return dailyMail(ctx);
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  if (request.headers.get("authorization") !== `Bearer ${env.cronSecret()}`)
    return json({ error: "forbidden" }, 401);
  const day = new Date().toISOString().slice(0, 10);
  const tasks = await dailyTasks();
  const pick = pickFor(day, ladderPool(tasks.map((t) => ({ ...t.exercise, tier: t.tier }))));
  const task = tasks.find((t) => t.exercise.id === pick?.id);
  const screen = task?.exercise.screens[0];
  if (!task || !screen) return json({ day, people: 0, sent: 0 });
  const today = {
    title: task.exercise.title,
    brief: screen.prompt,
    tier: task.tier,
    rows: screen.rows,
    answerCell: screen.answerCell,
  };

  const db = adminClient();
  const { data: people } = await db
    .from("profiles")
    .select("id, pro_status, pro_until")
    .eq("daily", true)
    .limit(MAX_PEOPLE);
  const kind = `daily:${day}`;
  let sent = 0;
  for (const person of people ?? []) {
    const { id } = person;
    // The primary key refuses a second row: someone already mailed today is skipped.
    const { error } = await db.from("mail_log").insert({ user_id: id, kind });
    if (error) continue;
    const [{ data: user }, { data: welcome }] = await Promise.all([
      db.auth.admin.getUserById(id),
      db.from("mail_log").select("sent_at").eq("user_id", id).eq("kind", "welcome").maybeSingle(),
    ]);
    const email = user?.user?.email;
    if (!email) continue;
    const which = mailFor({
      welcomedOn: (welcome?.sent_at as string | undefined)?.slice(0, 10) ?? null,
      today: day,
      pro: hasPro(person),
    });
    // The welcome row dates the series: later starter emails count days from it.
    if (which === "welcome") await db.from("mail_log").insert({ user_id: id, kind: "welcome" });
    const ctx: MailContext = {
      origin: url.origin,
      unsubscribe: `${url.origin}/api/email/unsubscribe/?t=${unsubscribeToken(env.unsubscribeKey(), id)}`,
      today,
    };
    const mail = await build(which, ctx, db, id, day);
    if (await sendMail({ to: email, ...mail, unsubscribe: ctx.unsubscribe })) sent += 1;
  }
  return json({ day, people: people?.length ?? 0, sent });
};
