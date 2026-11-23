// Why this exists: saves which opt-in email a person wants. The settings page
// sends mail=daily|weekly|never; the one-time card on /account/ sends only the
// daily switch (answer=1). Either way the choice also goes into the user's
// metadata, so the card knows it was answered. The old `news` column is no
// longer written.
import type { APIRoute } from "astro";
import { back, field, safePath } from "../../../server/http.ts";
import { currentUser } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const page = safePath(field(form, "from"), "/account/settings/");
  const { supabase, user } = await currentUser(ctx);
  if (!user)
    return back(`/login/?next=${page}`, {
      error: "Log in to change your email preferences.",
    });
  const mail = field(form, "mail");
  const card = form.get("answer") !== null;
  if (!card && !["daily", "weekly", "never"].includes(mail))
    return back(page, { error: "Choose which emails you want." });
  const daily = card ? form.get("daily") !== null : mail === "daily";
  const update = card ? { daily } : { daily, digest: mail === "weekly" };
  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return back(page, { error: "Your preference could not be saved. Try again." });
  // Only marks the question answered; a failure here just shows the card again.
  await supabase.auth.updateUser({ data: { daily } });
  const on = daily || update.digest === true;
  return back(page, {
    ok: on
      ? "Saved. You can turn emails off on the account settings or from the link in any email."
      : "Saved. We will not email you.",
  });
};
