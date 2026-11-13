// Why this exists: changes the account email. Supabase emails a confirmation
// link, and the new address only counts once it is confirmed.
import type { APIRoute } from "astro";
import { back, EMAIL, field } from "../../../server/http.ts";
import { currentUser } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const email = field(await ctx.request.formData(), "email");
  if (!EMAIL.test(email)) return back("/account/", { error: "Enter a valid email address." });
  const { supabase, user } = await currentUser(ctx);
  if (!user) return back("/login/?next=/account/", { error: "Log in to change your email." });
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${ctx.url.origin}/api/auth/callback/?next=/account/` },
  );
  if (error) return back("/account/", { error: error.message });
  return back("/account/", { ok: `Check ${email} for a link to confirm the change.` });
};
