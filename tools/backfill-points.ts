// Why this exists: run once when points launch. Each account's progress saved
// before then becomes "backfill" points rows, so learners keep credit for
// track exercises they already solved. These rows are not graded on the
// server (that progress came from the browser); everything after launch is.
// Drills and daily exercises are left out. Safe to run again: a solve already
// paid is skipped by the points_first_solve index.
//
//   node --env-file=.env.local tools/backfill-points.ts [--dry-run]
import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parse } from "yaml";
import { solvePoints } from "../src/lib/points.ts";
import { parentOf } from "../src/lib/steps.ts";

const dry = process.argv.includes("--dry-run");
const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SECRET_KEY"];
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

const levels = new Map<string, number>();
for (const f of readdirSync("content/exercises")) {
  const e = parse(readFileSync(`content/exercises/${f}`, "utf8")) as { id: string; level: number };
  levels.set(e.id, e.level);
}

const db = createClient(url, key, { auth: { persistSession: false } });
type Row = { user_id: string; exercise_id: string; entry: { state: string; date: string } };
const best = new Map<string, { user_id: string; item: string; day: string; points: number }>();
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from("progress")
    .select("user_id, exercise_id, entry")
    .range(from, from + 999);
  if (error) throw error;
  for (const r of (data ?? []) as Row[]) {
    const item = parentOf(r.exercise_id) ?? r.exercise_id;
    const level = levels.get(item);
    if (!level || (r.entry.state !== "solved" && r.entry.state !== "helped")) continue;
    const points = solvePoints("exercise", level, r.entry.state === "helped");
    const k = `${r.user_id} ${item}`;
    const had = best.get(k);
    if (!had || points > had.points)
      best.set(k, { user_id: r.user_id, item, day: had?.day ?? r.entry.date, points });
    else if (r.entry.date < had.day) had.day = r.entry.date;
  }
  if ((data ?? []).length < 1000) break;
}

let added = 0;
for (const row of best.values()) {
  if (dry) continue;
  const { error } = await db.from("points").insert({ ...row, kind: "backfill" });
  if (!error) added++;
  else if (error.code !== "23505") throw error;
}
console.log(
  `${best.size} solved exercises found, ${dry ? "dry run, nothing written" : `${added} rows added`}.`,
);
