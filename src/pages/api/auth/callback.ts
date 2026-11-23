// Why this exists: where links from Supabase land: Google sign-in, the
// confirmation email and the password reset email. It turns the code or token
// in the link into a session, then goes on to `next`.
import type { EmailOtpType } from "@supabase/supabase-js";
import type { APIRoute } from "astro";
import { back, redirect, safePath } from "../../../server/http.ts";
import { markSignedIn, userClient } from "../../../server/supabase.ts";

export const prerender = false;

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "email",
  "recovery",
  "email_change",
  "invite",
  "magiclink",
];

export const GET: APIRoute = async (ctx) => {
  const q = ctx.url.searchParams;
  const next = safePath(q.get("next"), "/account/");
  const supabase = userClient(ctx);
  const code = q.get("code");
  const tokenHash = q.get("token_hash");
  const type = q.get("type") as EmailOtpType | null;

  let failed = true;
  if (code) {
    failed = Boolean((await supabase.auth.exchangeCodeForSession(code)).error);
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    failed = Boolean((await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error);
  }
  if (failed) {
    return back("/login/", {
      error: "That link has expired or was already used. Log in, or ask for a new one.",
    });
  }
  markSignedIn(ctx, true);
  return redirect(next);
};
