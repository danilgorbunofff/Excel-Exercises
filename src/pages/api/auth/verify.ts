// Why this exists: confirms an email with the six-digit code from the
// confirmation email. Unlike the link, the code works in any browser. Then it
// goes on to ?next=, as Sign up passed it.
import type { APIRoute } from "astro";
import { back, field, redirect, safePath } from "../../../server/http.ts";
import { markSignedIn, userClient } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const email = field(form, "email");
  const next = safePath(field(form, "next"), "/account/");
  const { error } = await userClient(ctx).auth.verifyOtp({
    email,
    token: field(form, "code").replace(/\s/gu, ""),
    type: "email",
  });
  if (error) {
    return back(`/verify/?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`, {
      error:
        "That code is not right or has expired. Use the code in the newest email, or sign up again.",
    });
  }
  markSignedIn(ctx, true);
  return redirect(next);
};
