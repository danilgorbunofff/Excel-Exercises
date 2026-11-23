// Why this exists: a visitor can buy PRO without an account. Stripe gives only
// the email they typed, so the webhook and the success link both find or make
// the account for that email here.
import { adminClient } from "./supabase.ts";

export interface GuestAccount {
  id: string;
  /** Made for this purchase and never signed in: only then may the buyer be signed in from the success link. */
  isNew: boolean;
  /** A one-time token that signs this account in (verifyOtp, type "magiclink"). */
  tokenHash: string;
}

/** The account for this email, made if there is none. `since` is when checkout started, in ms. */
export async function accountForEmail(email: string, since: number): Promise<GuestAccount | null> {
  const admin = adminClient().auth.admin;
  // A known address fails here with email_exists; the link below finds that account either way.
  await admin.createUser({ email, email_confirm: true });
  const { data, error } = await admin.generateLink({ type: "magiclink", email });
  if (error || !data.user) return null;
  const { user, properties } = data;
  return {
    id: user.id,
    isNew: !user.last_sign_in_at && Date.parse(user.created_at) >= since,
    tokenHash: properties.hashed_token,
  };
}
