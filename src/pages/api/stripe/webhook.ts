// Why this exists: Stripe tells the site when PRO starts, changes or ends.
// The signature proves the call is from Stripe. A paid one-time checkout gives
// lifetime PRO. Subscription events can arrive out of order or twice, so each
// one re-reads the subscription from Stripe and writes its current state: the
// result is the same however often it runs. A guest checkout (no account yet)
// goes to the account for the email paid with.
import type { APIRoute } from "astro";
import type Stripe from "stripe";
import {
  lifetimeFields,
  type ProFields,
  proFields,
  subscriptionMayUpdate,
} from "../../../server/billing.ts";
import { env } from "../../../server/env.ts";
import { logEvent } from "../../../server/events.ts";
import { accountForEmail } from "../../../server/guest.ts";
import { stripe } from "../../../server/stripe.ts";
import { adminClient } from "../../../server/supabase.ts";

export const prerender = false;

const SUBSCRIPTION_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];
const CHECKOUT_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];

const idOf = (v: string | { id: string } | null): string | null =>
  v === null ? null : typeof v === "string" ? v : v.id;

/** Writes the PRO fields to the profile found by user id, else by Stripe customer. */
async function save(fields: ProFields, userId: string | null): Promise<Response> {
  const [col, value] = userId
    ? (["id", userId] as const)
    : (["stripe_customer_id", fields.stripe_customer_id] as const);
  // A fresh builder per query: postgrest builders share one URL and would mix filters.
  const profiles = () => adminClient().from("profiles");
  if (fields.pro_status !== "lifetime") {
    const { data } = await profiles().select("pro_status").eq(col, value).maybeSingle();
    if (!subscriptionMayUpdate(data?.pro_status)) {
      return new Response("Lifetime kept", { status: 200 });
    }
  }
  const { error } = await profiles()
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq(col, value);
  // A 500 makes Stripe retry later.
  if (error) return new Response("Save failed", { status: 500 });
  return new Response("OK", { status: 200 });
}

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("No signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      await request.text(),
      signature,
      env.stripeWebhookSecret(),
    );
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  let subscriptionId: string | null = null;
  if (CHECKOUT_EVENTS.includes(event.type)) {
    const session = event.data.object as Stripe.Checkout.Session;
    const customer = idOf(session.customer);
    const guest = !session.client_reference_id;
    let userId = session.client_reference_id;
    if (guest) {
      // A guest checkout: PRO goes to the account for the email paid with, made if there is none.
      const email = session.customer_details?.email;
      if (!email || !customer) return new Response("No email", { status: 200 });
      const account = await accountForEmail(email, session.created * 1000);
      if (!account) return new Response("Account failed", { status: 500 });
      const { error } = await adminClient()
        .from("profiles")
        .update({ stripe_customer_id: customer })
        .eq("id", account.id);
      if (error) return new Response("Save failed", { status: 500 });
      userId = account.id;
    }
    if (session.mode === "payment") {
      if (session.payment_status !== "paid" || !customer)
        return new Response("Not paid yet", { status: 200 });
      return counted(await save(lifetimeFields(customer), userId));
    }
    subscriptionId = idOf(session.subscription);
    // Later subscription events find the account by this id.
    if (guest && subscriptionId && userId)
      await stripe().subscriptions.update(subscriptionId, { metadata: { user_id: userId } });
  } else if (SUBSCRIPTION_EVENTS.includes(event.type)) {
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  }
  if (!subscriptionId) return new Response("Ignored", { status: 200 });

  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const res = await save(proFields(sub), sub.metadata["user_id"] ?? null);
  // A checkout is the one event per purchase; subscription updates are not new buyers.
  return CHECKOUT_EVENTS.includes(event.type) ? counted(res) : res;
};

/** Counts one new PRO purchase once its save went through. */
async function counted(res: Response): Promise<Response> {
  if (res.ok) await logEvent("pro_active");
  return res;
}
