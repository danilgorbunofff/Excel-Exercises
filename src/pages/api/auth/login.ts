// Why this exists: signs in with email and password from the Log in form.
import type { APIRoute } from "astro";
import { back, field, redirect, safePath } from "../../../server/http.ts";
import { markSignedIn, userClient } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const next = safePath(field(form, "next"), "/account/");
  const { error } = await userClient(ctx).auth.signInWithPassword({
    email: field(form, "email"),
    password: String(form.get("password") ?? ""),
  });
  if (error) {
    const message =
      error.code === "email_not_confirmed"
        ? "Confirm your email first. Use the link or the code we sent you."
        : "The email or the password is not right. Check both and try again.";
    return back(`/login/?next=${encodeURIComponent(next)}`, { error: message });
  }
  markSignedIn(ctx, true);
  return redirect(next);
};
