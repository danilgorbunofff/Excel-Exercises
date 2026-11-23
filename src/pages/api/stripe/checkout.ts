// Why this exists: starts PRO on Stripe Checkout: a subscription for a
// recurring price, a one-time payment for lifetime. A signed-in buyer's Stripe
// customer carries the user id, so the webhook can find the account. A guest
// pays without an account: Stripe asks for the email, the webhook makes the
// account for it, and /api/stripe/claim/ signs the buyer in. "Continue with
// Google" signs in first and comes back here by GET with the plan.
import type { APIContext, APIRoute } from "astro";
import { hasPro } from "../../../lib/access.ts";
import { logEvent } from "../../../server/events.ts";
import { back, field, redirect } from "../../../server/http.ts";
import { offeredPlans, priceIdFor } from "../../../server/plans.ts";
import { stripe } from "../../../server/stripe.ts";
import { adminClient, currentUser } from "../../../server/supabase.ts";

export const prerender = false;

const start = async (ctx: APIContext, plan: string, via: string): Promise<Response> => {
  // A plan off sale (semiannual, an ended lifetime offer) cannot be bought, even with its price id set.
  const priceId = offeredPlans().some((p) => p.key === plan) ? priceIdFor(plan) : null;
  if (!priceId) return back("/pricing/", { error: "Choose a plan, then try again." });
  const { supabase, user } = await currentUser(ctx);
  if (!user && via === "google")
    return redirect(
      `/api/auth/google/?next=${encodeURIComponent(`/api/stripe/checkout/?plan=${plan}`)}`,
    );

  const price = await stripe().prices.retrieve(priceId);
  const oneTime = price.type === "one_time";
  const common = {
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    cancel_url: `${ctx.url.origin}/pricing/`,
  };

  if (!user) {
    const session = await stripe().checkout.sessions.create({
      ...common,
      ...(oneTime
        ? { mode: "payment", customer_creation: "always", invoice_creation: { enabled: true } }
        : { mode: "subscription" }),
      success_url: `${ctx.url.origin}/api/stripe/claim/?session_id={CHECKOUT_SESSION_ID}`,
    });
    if (!session.url) return back("/pricing/", { error: "Checkout could not start. Try again." });
    await logEvent("checkout_start", "/pricing/");
    return redirect(session.url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, pro_status, pro_until")
    .eq("id", user.id)
    .maybeSingle();
  if (hasPro(profile)) {
    return back("/account/billing/", {
      ok: "You already have PRO. Change your plan with Manage in Stripe.",
    });
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

  const metadata = { user_id: user.id };
  const session = await stripe().checkout.sessions.create({
    ...common,
    customer,
    client_reference_id: user.id,
    ...(oneTime
      ? { mode: "payment", payment_intent_data: { metadata }, invoice_creation: { enabled: true } }
      : { mode: "subscription", subscription_data: { metadata } }),
    success_url: `${ctx.url.origin}/subscribe/?ok=1`,
  });
  if (!session.url) return back("/pricing/", { error: "Checkout could not start. Try again." });
  await logEvent("checkout_start", "/pricing/");
  return redirect(session.url);
};

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  return start(ctx, field(form, "plan"), field(form, "via"));
};

/** Where "Continue with Google" lands after sign-in. */
export const GET: APIRoute = (ctx) => start(ctx, ctx.url.searchParams.get("plan") ?? "", "");
