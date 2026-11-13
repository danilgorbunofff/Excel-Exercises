// Why this exists: starts PRO on Stripe Checkout: a subscription for a
// recurring price, a one-time payment for lifetime. The Stripe customer
// carries the user id, so the webhook can find the account.
import type { APIRoute } from "astro";
import { hasPro } from "../../../lib/access.ts";
import { back, field, redirect } from "../../../server/http.ts";
import { priceIdFor } from "../../../server/plans.ts";
import { stripe } from "../../../server/stripe.ts";
import { adminClient, currentUser } from "../../../server/supabase.ts";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const priceId = priceIdFor(field(await ctx.request.formData(), "plan"));
  if (!priceId) return back("/pricing/", { error: "Choose a plan, then try again." });
  const { supabase, user } = await currentUser(ctx);
  if (!user)
    return back("/login/?next=/pricing/", {
      error: "Log in or sign up first, then choose your plan.",
    });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, pro_status, pro_until")
    .eq("id", user.id)
    .maybeSingle();
  if (hasPro(profile)) {
    return back("/account/", { ok: "You already have PRO. Change your plan with Manage billing." });
  }

  let customer = profile?.stripe_customer_id ?? null;
  if (!customer) {
    customer = (
      await stripe().customers.create({
        ...(user.email ? { email: user.email } : {}),
        metadata: { user_id: user.id },
      })
    ).id;
    const { error } = await adminClient()
      .from("profiles")
      .update({ stripe_customer_id: customer })
      .eq("id", user.id);
    if (error) return back("/pricing/", { error: "Checkout could not start. Try again." });
  }

  const price = await stripe().prices.retrieve(priceId);
  const metadata = { user_id: user.id };
  const session = await stripe().checkout.sessions.create({
    customer,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    ...(price.type === "one_time"
      ? { mode: "payment", payment_intent_data: { metadata }, invoice_creation: { enabled: true } }
      : { mode: "subscription", subscription_data: { metadata } }),
    allow_promotion_codes: true,
    success_url: `${ctx.url.origin}/subscribe/?ok=1`,
    cancel_url: `${ctx.url.origin}/pricing/`,
  });
  if (!session.url) return back("/pricing/", { error: "Checkout could not start. Try again." });
  return redirect(session.url);
};
