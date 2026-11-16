// Why this exists: the public lookup behind /certificates/<id>/. It uses the
// service role, because the visitor is anyone with the link, and selects only
// the fields the page may show: never the email, the user id or the attempt.
import { CERTIFICATE_ID } from "../lib/certificates.ts";
import { adminClient } from "./supabase.ts";

export interface PublicCertificate {
  name: string;
  assessment_title: string;
  score: number;
  total: number;
  time_limit_s: number;
  issued_at: string;
  revoked_at: string | null;
}

export const PUBLIC_FIELDS =
  "name, assessment_title, score, total, time_limit_s, issued_at, revoked_at";

/** The certificate's public fields, or null when no certificate has this id. */
export async function publicCertificate(id: string): Promise<PublicCertificate | null> {
  if (!CERTIFICATE_ID.test(id)) return null;
  const { data, error } = await adminClient()
    .from("certificates")
    .select(PUBLIC_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`certificate lookup failed: ${error.message}`);
  return (data as PublicCertificate | null) ?? null;
}
