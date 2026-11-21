// Why this exists: opens the Stripe Customer Portal, where a PRO user changes
// plan, updates the card, sees invoices or cancels.
import type { APIRoute } from "astro";
import { back, redirect } from "../../../server/http.ts";
import { stripe } from "../../../server/stripe.ts";
import { currentUser } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return back("/login/?next=/account/", { error: "Log in to manage billing." });
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.stripe_customer_id)
    return back("/account/", { error: "This account has no billing yet. Choose a plan on the pricing page to start PRO." });
  const session = await stripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${ctx.url.origin}/account/`,
  });
  return redirect(session.url);
};
