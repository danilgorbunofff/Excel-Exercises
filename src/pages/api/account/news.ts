// Why this exists: turns the two opt-in emails on or off: "new exercises" and
// the weekly progress email.
import type { APIRoute } from "astro";
import { back } from "../../../server/http.ts";
import { currentUser } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const news = form.get("news") !== null;
  const digest = form.get("digest") !== null;
  const { supabase, user } = await currentUser(ctx);
  if (!user)
    return back("/login/?next=/account/", { error: "Log in to change your email preferences." });
  const { error } = await supabase.from("profiles").update({ news, digest }).eq("id", user.id);
  if (error) return back("/account/", { error: "Your preference could not be saved. Try again." });
  return back("/account/", {
    ok:
      news || digest
        ? "Saved. You can turn emails off here or from the link in any email."
        : "Saved. We will not email you.",
  });
};
