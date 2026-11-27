// Why this exists: sets or clears the nickname the scoreboard shows. With none
// a person stays off the public board. The settings page posts the form; the
// database also checks the characters and that no one else has the name.
import type { APIRoute } from "astro";
import { NICKNAME } from "../../../lib/points.ts";
import { back, field, safePath } from "../../../server/http.ts";
import { currentUser } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const page = safePath(field(form, "from"), "/account/settings/");
  const { supabase, user } = await currentUser(ctx);
  if (!user) return back(`/login/?next=${page}`, { error: "Log in to choose a nickname." });
  const nickname = field(form, "nickname");
  if (nickname !== "" && !NICKNAME.test(nickname))
    return back(page, {
      error: "Use 3 to 20 letters, digits or underscores for your nickname.",
    });
  const { error } = await supabase
    .from("profiles")
    .update({ nickname: nickname || null })
    .eq("id", user.id);
  if (error?.code === "23505")
    return back(page, { error: "Someone already has that nickname. Try another." });
  if (error) return back(page, { error: "Your nickname could not be saved. Try again." });
  return back(page, {
    ok: nickname
      ? `Saved. You appear on the scoreboard as ${nickname}.`
      : "Saved. You are off the public scoreboard.",
  });
};
