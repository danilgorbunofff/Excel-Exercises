// Why this exists: sends the password reset email. It says the same thing
// whether or not the address has an account, so it cannot be used to find one.
import type { APIRoute } from "astro";
import { back, EMAIL, field } from "../../../server/http.ts";
import { userClient } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const email = field(await ctx.request.formData(), "email");
  if (!EMAIL.test(email))
    return back("/forgot-password/", { error: "Enter a valid email address." });
  await userClient(ctx).auth.resetPasswordForEmail(email, {
    redirectTo: `${ctx.url.origin}/api/auth/callback/?next=/reset-password/`,
  });
  return back("/forgot-password/", {
    ok: "If that address has an account, a link to set a new password is on its way.",
  });
};
