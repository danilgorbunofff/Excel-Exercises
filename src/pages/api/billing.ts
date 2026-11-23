// Why this exists: what the Plan and billing page shows from Stripe: the plan
// the user pays for, when it renews, the card on file and the payment history.
// Read-only: changes go through the Stripe Customer Portal (stripe/portal.ts).
import type { APIRoute } from "astro";
import { LIFETIME } from "../../lib/access.ts";
import {
  type BillingInfo,
  cardFrom,
  paymentsFrom,
  planKeyFor,
  proFields,
} from "../../server/billing.ts";
import { json } from "../../server/http.ts";
import { PLANS, priceIdFor } from "../../server/plans.ts";
import { stripe } from "../../server/stripe.ts";
import { currentUser } from "../../server/supabase.ts";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const { supabase, user } = await currentUser(ctx);
  if (!user) return json({ error: "signed out" }, 401);
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, pro_status")
    .eq("id", user.id)
    .maybeSingle();
  const lifetime = profile?.pro_status === LIFETIME;
  const empty: BillingInfo = {
    plan: lifetime ? "lifetime" : null,
    renews: null,
    ending: false,
    card: null,
    payments: [],
  };
  const customer = profile?.stripe_customer_id;
  // No customer yet, or a build with no Stripe key (local development): nothing to read.
  if (!customer || !process.env["STRIPE_SECRET_KEY"]) return json(empty);

  try {
    const s = stripe();
    const [cust, subs, charges] = await Promise.all([
      s.customers.retrieve(customer, { expand: ["invoice_settings.default_payment_method"] }),
      s.subscriptions.list({ customer, status: "all", limit: 1 }),
      s.charges.list({ customer, limit: 12 }),
    ]);
    const sub = subs.data[0];
    const live = sub && ["active", "trialing", "past_due"].includes(sub.status) ? sub : null;
    const pm =
      !cust.deleted && typeof cust.invoice_settings.default_payment_method === "object"
        ? cust.invoice_settings.default_payment_method
        : null;
    const info: BillingInfo = {
      plan: lifetime
        ? "lifetime"
        : planKeyFor(
            live?.items.data[0]?.price.id,
            PLANS.map((p) => p.key),
            priceIdFor,
          ),
      renews: live ? proFields(live).pro_until : null,
      ending: live?.cancel_at_period_end ?? false,
      card: cardFrom(pm?.card) ?? cardFrom(charges.data[0]?.payment_method_details?.card),
      payments: paymentsFrom(charges.data),
    };
    return json(info);
  } catch {
    return json({ error: "Stripe did not answer. Try again in a minute." }, 502);
  }
};
