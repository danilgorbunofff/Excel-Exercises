// Why this exists: the only way a certificate is made. POST checks the stored
// attempt itself: it marks the stored formulas again with the grader, checks
// the server's own start and receipt times, the pass mark and PRO, and only
// then inserts with the service role. GET lists the user's certificates and
// PATCH revokes one of them.
import type { APIRoute } from "astro";
import { hasPro } from "../../lib/access.ts";
import { gradeAttempt, loadAssessments } from "../../lib/assessments.ts";
import {
  CERTIFICATE_ID,
  certificatePath,
  checkIssue,
  cleanName,
  type StoredAttempt,
} from "../../lib/certificates.ts";
import { loadSpecs } from "../../server/assessment-specs.ts";
import { json } from "../../server/http.ts";
import { newCertificateId } from "../../server/start-token.ts";
import { adminClient, currentUser } from "../../server/supabase.ts";

export const prerender = false;

const LIST_FIELDS =
  "id, name, assessment, assessment_title, score, total, time_limit_s, issued_at, revoked_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export const GET: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const { data, error } = await supabase
    .from("certificates")
    .select(LIST_FIELDS)
    .order("issued_at", { ascending: false })
    .limit(100);
  if (error) return json({ error: "read failed" }, 500);
  return json(data ?? []);
};

export const POST: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const body = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const attemptId = String(body?.["attempt"] ?? "");
  const name = cleanName(body?.["name"]);
  if (!UUID.test(attemptId)) return json({ error: "no such attempt" }, 404);
  if (!name)
    return json(
      {
        error:
          "Type your name in letters, spaces, dots, hyphens or apostrophes, up to 80 characters.",
      },
      400,
    );

  const [{ data: profile }, { data: attempt }] = await Promise.all([
    supabase.from("profiles").select("pro_status, pro_until").eq("id", user.id).maybeSingle(),
    // Row-level security keeps this to the user's own attempts.
    supabase
      .from("assessment_attempts")
      .select(
        "id, assessment, score, total, time_limit_s, server_started_at, received_at, formulas",
      )
      .eq("id", attemptId)
      .maybeSingle(),
  ]);
  if (!attempt) return json({ error: "no such attempt" }, 404);
  const row = attempt as StoredAttempt & { id: string; formulas: unknown };

  const set = loadAssessments().sets.find((s) => s.slug === row.assessment);
  const formulas = Array.isArray(row.formulas) ? row.formulas.map(String) : null;
  const regraded = set && formulas ? gradeAttempt(set, formulas, await loadSpecs()) : null;
  const check = checkIssue({ set, attempt: row, regraded, pro: hasPro(profile) });
  if (!check.ok) return json({ error: check.error }, check.status);

  const admin = adminClient();
  const existing = () =>
    admin
      .from("certificates")
      .select(LIST_FIELDS)
      .eq("user_id", user.id)
      .eq("assessment", row.assessment)
      .is("revoked_at", null)
      .maybeSingle();
  const found = await existing();
  if (found.data) return json({ ...found.data, url: certificatePath(found.data.id) }, 200);

  const { data, error } = await admin
    .from("certificates")
    .insert({
      id: newCertificateId(),
      user_id: user.id,
      attempt_id: row.id,
      assessment: row.assessment,
      assessment_title: set?.title ?? row.assessment,
      name,
      score: row.score,
      total: row.total,
      time_limit_s: row.time_limit_s,
    })
    .select(LIST_FIELDS)
    .single();
  if (error?.code === "23505") {
    // Another request issued it a moment ago: hand back that one.
    const again = await existing();
    if (again.data) return json({ ...again.data, url: certificatePath(again.data.id) }, 200);
  }
  if (error || !data) return json({ error: "save failed" }, 500);
  return json({ ...data, url: certificatePath(data.id) }, 201);
};

export const PATCH: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const body = (await ctx.request.json().catch(() => null)) as { id?: unknown } | null;
  const id = String(body?.id ?? "");
  if (!CERTIFICATE_ID.test(id)) return json({ error: "no such certificate" }, 404);
  const { data, error } = await supabase
    .from("certificates")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id, revoked_at");
  if (error) return json({ error: "revoke failed" }, 500);
  if (!data || data.length === 0) return json({ error: "no such certificate" }, 404);
  return json(data[0]);
};
