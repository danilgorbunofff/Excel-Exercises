// Why this exists: turns the "new exercises" email on or off.
import type { APIRoute } from "astro";
import { back } from "../../../server/http.ts";
import { currentUser } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const news = (await ctx.request.formData()).get("news") !== null;
  const { supabase, user } = await currentUser(ctx);
  if (!user)
    return back("/login/?next=/account/", { error: "Log in to change your email preferences." });
  const { error } = await supabase.from("profiles").update({ news }).eq("id", user.id);
  if (error) return back("/account/", { error: "Your preference could not be saved. Try again." });
  return back("/account/", {
    ok: news
      ? "We will email you when new exercises arrive."
      : "No more emails about new exercises.",
  });
};
