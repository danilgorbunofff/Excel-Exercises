// Why this exists: sets a new password, from the reset link page or from
// account settings. Both need a signed-in session.
import type { APIRoute } from "astro";
import { back, field, MIN_PASSWORD, safePath } from "../../../server/http.ts";
import { currentUser } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const page = safePath(field(form, "from"), "/account/");
  const password = String(form.get("password") ?? "");
  if (password.length < MIN_PASSWORD) {
    return back(page, { error: `Use a password of at least ${MIN_PASSWORD} characters.` });
  }
  if (password !== String(form.get("password2") ?? "")) {
    return back(page, { error: "The two passwords do not match." });
  }
  const { supabase, user } = await currentUser(ctx);
  if (!user) return back("/login/", { error: "Your reset link has expired. Ask for a new one." });
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return back(page, { error: error.message });
  return back("/account/", { ok: "Your new password is saved." });
};
