// Why this exists: deletes the account for good. It cancels any PRO
// subscription first so nobody is charged for an account that is gone, then
// removes the user; their profile, progress, daily solves, assessment results
// and certificates go with it (on delete cascade), so a certificate's public
// page then says no certificate has that number.
import type { APIRoute } from "astro";
import { back, field, redirect } from "../../../server/http.ts";
import { stripe } from "../../../server/stripe.ts";
import { adminClient, currentUser, markSignedIn } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  if (field(form, "confirm").toUpperCase() !== "DELETE") {
    return back("/account/", { error: "Type DELETE to confirm." });
  }
  const { supabase, user } = await currentUser(ctx);
  if (!user) return back("/login/?next=/account/", { error: "Log in to delete your account." });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.stripe_customer_id) {
    const subs = await stripe().subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "all",
    });
    for (const s of subs.data) {
      if (s.status !== "canceled" && s.status !== "incomplete_expired")
        await stripe().subscriptions.cancel(s.id);
    }
  }
  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error)
    return back("/account/", {
      error: "Your account could not be deleted. Try again, or contact us.",
    });
  await supabase.auth.signOut();
  markSignedIn(ctx, false);
  return redirect("/?ok=Your+account+is+deleted.");
};
