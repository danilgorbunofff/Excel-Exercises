// Why this exists: confirms an email with the six-digit code from the
// confirmation email. Unlike the link, the code works in any browser.
import type { APIRoute } from "astro";
import { back, field, redirect } from "../../../server/http.ts";
import { markSignedIn, userClient } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const email = field(form, "email");
  const { error } = await userClient(ctx).auth.verifyOtp({
    email,
    token: field(form, "code").replace(/\s/gu, ""),
    type: "email",
  });
  if (error) {
    return back(`/verify/?email=${encodeURIComponent(email)}`, {
      error:
        "That code is not right or has expired. Use the code in the newest email, or sign up again.",
    });
  }
  markSignedIn(ctx, true);
  return redirect("/account/");
};
