// Why this exists: the scoreboard on Home. The top six of the week (from
// Monday 00:00 UTC) or of all time, only people who chose a nickname, and the
// signed-in learner's own points and rank whether they chose one or not. The
// points table is private per user, so the board is read with the service
// role through two database functions.
import type { APIRoute } from "astro";
import { mondayOf } from "../../lib/daily.ts";
import { BOARD_ROWS, type Level, levelFor } from "../../lib/points.ts";
import { json } from "../../server/http.ts";
import { adminClient, currentUser } from "../../server/supabase.ts";

export const prerender = false;

export interface ScoreRow {
  rank: number;
  nickname: string;
  points: number;
  level: Level;
}
export interface Scoreboard {
  period: "week" | "all";
  top: ScoreRow[];
  /** Null when signed out. */
  me: {
    nickname: string | null;
    rank: number | null;
    /** Points in the period. */
    points: number;
    /** All-time points, which set the level. */
    total: number;
    level: Level;
  } | null;
}

export const GET: APIRoute = async (ctx) => {
  const period = new URL(ctx.request.url).searchParams.get("period") === "all" ? "all" : "week";
  const since =
    period === "week"
      ? `${mondayOf(new Date().toISOString().slice(0, 10))}T00:00:00Z`
      : "1970-01-01T00:00:00Z";
  const admin = adminClient();
  const [{ data: rows, error }, { supabase, user }] = await Promise.all([
    admin.rpc("scoreboard", { p_since: since, p_limit: BOARD_ROWS }),
    currentUser(ctx),
  ]);
  if (error) return json({ error: "read failed" }, 500);
  const top = (
    (rows ?? []) as { rank: number; nickname: string; points: number; total: number }[]
  ).map((r) => ({
    rank: Number(r.rank),
    nickname: r.nickname,
    points: Number(r.points),
    level: levelFor(Number(r.total)),
  }));
  let me: Scoreboard["me"] = null;
  if (user) {
    const [{ data: mine }, { data: profile }] = await Promise.all([
      admin.rpc("scoreboard_me", { p_user: user.id, p_since: since }),
      supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle(),
    ]);
    const m = (mine as { points: number; total: number; rank: number | null }[] | null)?.[0];
    me = {
      nickname: (profile as { nickname: string | null } | null)?.nickname ?? null,
      rank: m?.rank == null ? null : Number(m.rank),
      points: Number(m?.points ?? 0),
      total: Number(m?.total ?? 0),
      level: levelFor(Number(m?.total ?? 0)),
    };
  }
  const board: Scoreboard = { period, top, me };
  return json(board);
};
