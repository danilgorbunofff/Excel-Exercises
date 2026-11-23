// Why this exists: creates an account from the Sign up form. Supabase sends
// the confirmation email; the visitor then lands on /verify/. A ?next= path
// rides along, so a sign-up from a result page returns there.
import type { APIRoute } from "astro";
import { back, EMAIL, field, MIN_PASSWORD, redirect, safePath } from "../../../server/http.ts";
import { markSignedIn, userClient } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const email = field(form, "email");
  const password = String(form.get("password") ?? "");
  const password2 = String(form.get("password2") ?? "");
  const next = safePath(field(form, "next"), "/account/");
  const page = `/register/?next=${encodeURIComponent(next)}`;
  if (!EMAIL.test(email)) return back(page, { error: "Enter a valid email address." });
  if (password.length < MIN_PASSWORD) {
    return back(page, { error: `Use a password of at least ${MIN_PASSWORD} characters.` });
  }
  if (password !== password2) return back(page, { error: "The two passwords do not match." });
  if (form.get("terms") === null) {
    return back(page, { error: "Agree to the terms and the privacy policy to sign up." });
  }

  const { data, error } = await userClient(ctx).auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${ctx.url.origin}/api/auth/callback/?next=${encodeURIComponent(next)}`,
      data: { daily: form.get("daily") !== null },
    },
  });
  if (error) return back(page, { error: error.message });
  // With email confirmation turned off, Supabase signs the user in at once.
  if (data.session) {
    markSignedIn(ctx, true);
    return redirect(next);
  }
  return redirect(`/verify/?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
};
