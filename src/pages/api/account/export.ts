// Why this exists: hands a signed-in user everything their account keeps, as
// one JSON file. It reads with the user's own client, so row level security
// limits it to their rows. Progress kept only in a browser is not here.
import type { APIRoute } from "astro";
import { json } from "../../../server/http.ts";
import { currentUser, markSignedIn } from "../../../server/supabase.ts";

export const prerender = false;

/** Rows per table: far above real use, so one request stays small. */
export const EXPORT_LIMIT = 5000;

/** What each table gives, by its name in the file. No Stripe ids, no user ids. */
const TABLES = {
  progress: ["progress", "exercise_id, entry, updated_at", "exercise_id"],
  assessment_attempts: [
    "assessment_attempts",
    "id, assessment, started_at, finished_at, time_limit_s, score, total, results, formulas, server_started_at, received_at",
    "started_at",
  ],
  daily_solves: ["daily_solves", "day, exercise, solved_at", "day"],
  certificates: [
    "certificates",
    "id, assessment, assessment_title, name, score, total, time_limit_s, issued_at, revoked_at",
    "issued_at",
  ],
} as const;

export const GET: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) {
    markSignedIn(ctx, false);
    return json({ error: "signed out" }, 401);
  }
  const profile = await supabase
    .from("profiles")
    .select("pro_status, pro_until, news, updated_at")
    .eq("id", user.id)
    .maybeSingle();
  const rows = await Promise.all(
    Object.entries(TABLES).map(async ([key, [table, columns, order]]) => {
      const r = await supabase
        .from(table)
        .select(columns)
        .eq("user_id", user.id)
        .order(order)
        .limit(EXPORT_LIMIT);
      return [key, r] as const;
    }),
  );
  if (profile.error || rows.some(([, r]) => r.error)) {
    return json({ error: "Your data could not be read. Try again in a minute." }, 500);
  }
  const now = new Date();
  const file = {
    exportedAt: now.toISOString(),
    profile: {
      email: user.email ?? "",
      createdAt: user.created_at,
      proStatus: profile.data?.pro_status ?? null,
      proUntil: profile.data?.pro_until ?? null,
      news: profile.data?.news ?? false,
      updatedAt: profile.data?.updated_at ?? null,
    },
    ...Object.fromEntries(rows.map(([key, r]) => [key, r.data ?? []])),
  };
  return new Response(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="excelexercises-data-${now.toISOString().slice(0, 10)}.json"`,
    },
  });
};
