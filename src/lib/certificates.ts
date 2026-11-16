// Why this exists: the rules for issuing a certificate, kept pure so they can
// be tested without a database. The issuing endpoint asks here; the browser's
// word never decides. A certificate records a passed, timed mock assessment
// whose formulas the server marked itself. No Node imports: the assessment
// page uses the pass mark too.
import type { AssessmentSet } from "./assessments.ts";

/** The pass mark: 80% or more, in whole numbers so 4 of 5 passes exactly. */
export const passes = (score: number, total: number): boolean =>
  total > 0 && score * 5 >= total * 4;

/** Seconds allowed past the time limit, for the network and a slow device. */
export const GRACE_S = 120;

export const certificatePath = (id: string) => `/certificates/${id}/`;

export const CERTIFICATE_ID = /^[A-Za-z0-9_-]{22}$/u;

const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

/** The name as it will be printed, or null when it is empty, too long or has other characters. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  return name.length >= 1 && name.length <= 80 && NAME.test(name) ? name : null;
}

/** What the issuing check needs about a stored attempt. */
export interface StoredAttempt {
  assessment: string;
  score: number;
  total: number;
  time_limit_s: number | null;
  server_started_at: string | null;
  received_at: string;
}

export type IssueCheck = { ok: true } | { ok: false; status: number; error: string };

/**
 * Whether this attempt earns a certificate. `regraded` is the score the
 * server just got by marking the stored formulas again.
 */
export function checkIssue(input: {
  set: AssessmentSet | undefined;
  attempt: StoredAttempt;
  regraded: { score: number; total: number } | null;
  pro: boolean;
}): IssueCheck {
  const { set, attempt, regraded, pro } = input;
  const no = (status: number, error: string): IssueCheck => ({ ok: false, status, error });
  if (!set) return no(400, "unknown assessment");
  if (set.sample) return no(403, "the sample assessment has no certificate");
  if (!pro) return no(403, "PRO needed");
  if (attempt.time_limit_s !== set.minutes * 60)
    return no(403, "only timed runs earn a certificate");
  if (!attempt.server_started_at) return no(403, "the start of this run was not recorded");
  const took = (Date.parse(attempt.received_at) - Date.parse(attempt.server_started_at)) / 1000;
  if (!(took >= 0 && took <= set.minutes * 60 + GRACE_S)) return no(403, "the run went over time");
  if (!regraded) return no(409, "this attempt can no longer be marked");
  if (regraded.score !== attempt.score || regraded.total !== attempt.total)
    return no(409, "re-grade mismatch");
  if (!passes(regraded.score, regraded.total)) return no(403, "below the pass mark");
  return { ok: true };
}
