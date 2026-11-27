// Why this exists: points come only from solves the server marked itself. The
// exercise page sends the formula of every screen when a signed-in learner
// solves a task; this grades each with the same grader, checks the account
// may practise it, and writes what the solve earns (see lib/points.ts) to the
// points table with the service role. Progress itself still syncs through
// /api/progress/, which trusts the browser and pays nothing.
import { grade } from "@practice/grader";
import type { APIRoute } from "astro";
import { isDay, ladderPool, pickFor } from "../../lib/daily.ts";
import { dailyTasks } from "../../lib/exercises.ts";
import { award, levelFor, type PointsRow, type SolveResult } from "../../lib/points.ts";
import { addDays } from "../../scripts/progress.ts";
import { json } from "../../server/http.ts";
import { hasPracticeAccess, practiceTask } from "../../server/practice.ts";
import { adminClient, currentUser } from "../../server/supabase.ts";

export const prerender = false;

const MAX_BODY = 20_000;
const MAX_FORMULA = 2000;

export const POST: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const text = await ctx.request.text().catch(() => "");
  if (text.length > MAX_BODY) return json({ error: "too large" }, 413);
  let body: Record<string, unknown> = {};
  try {
    body = (JSON.parse(text) ?? {}) as Record<string, unknown>;
  } catch {
    return json({ error: "not JSON" }, 400);
  }
  const { id, formulas, helped, day } = body;
  // The learner's own day, which is at most a day either side of UTC.
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (
    typeof id !== "string" ||
    !Array.isArray(formulas) ||
    !formulas.every((f) => typeof f === "string" && f.length <= MAX_FORMULA) ||
    !isDay(day) ||
    day < addDays(todayUtc, -1) ||
    day > addDays(todayUtc, 1)
  ) {
    return json({ error: "not a valid solve" }, 400);
  }
  const task = await practiceTask(id);
  if (!task) return json({ error: "not found" }, 404);
  if (
    task.locked &&
    !(await hasPracticeAccess(supabase, user.id, task.kind === "drill" ? task.slug : null))
  )
    return json({ error: "PRO needed" }, 403);
  const solved =
    formulas.length === task.specs.length &&
    task.specs.every((spec, i) => grade(String(formulas[i]).trim(), spec).correct);
  if (!solved) return json({ error: "not solved" }, 422);

  const admin = adminClient();
  const columns = "item, kind, day, points";
  const [itemRows, dailyRows] = await Promise.all([
    admin.from("points").select(columns).eq("user_id", user.id).eq("item", task.item),
    task.kind === "daily"
      ? admin
          .from("points")
          .select(columns)
          .eq("user_id", user.id)
          .eq("kind", "daily")
          .order("day", { ascending: false })
          .limit(400)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemRows.error || dailyRows.error) return json({ error: "read failed" }, 500);
  const isPick =
    task.kind === "daily"
      ? pickFor(day, ladderPool((await dailyTasks()).map((t) => ({ ...t.exercise, tier: t.tier }))))
          ?.id === id
      : false;
  let earned = award(
    { kind: task.kind, item: task.item, level: task.level, helped: helped === true, day, isPick },
    (itemRows.data ?? []) as PointsRow[],
    (dailyRows.data ?? []) as PointsRow[],
  );
  if (earned.length > 0) {
    const { error } = await admin
      .from("points")
      .insert(earned.map((r) => ({ ...r, user_id: user.id })));
    // Another tab or device was faster: that solve already paid.
    if (error?.code === "23505") earned = [];
    else if (error) return json({ error: "save failed" }, 500);
  }
  if (task.kind === "daily" && isPick) {
    // A verified daily solve also counts for the streak on every device.
    await supabase
      .from("daily_solves")
      .upsert(
        { user_id: user.id, day, exercise: id },
        { onConflict: "user_id,day", ignoreDuplicates: true },
      );
  }
  const { data: me } = await admin.rpc("scoreboard_me", {
    p_user: user.id,
    p_since: new Date().toISOString(),
  });
  const total = Number((me as { total?: number }[] | null)?.[0]?.total ?? 0);
  const result: SolveResult = {
    earned: earned.map(({ kind, points }) => ({ kind, points })),
    total,
    level: levelFor(total),
  };
  return json(result, earned.length > 0 ? 201 : 200);
};
