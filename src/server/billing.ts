// Why this exists: turns a Stripe subscription or lifetime payment into the
// PRO fields of a profile. Kept apart from the webhook so it is tested
// without Stripe.
import { LIFETIME } from "../lib/access.ts";

/** The parts of a Stripe subscription this site reads. */
export interface SubscriptionLike {
  customer: string | { id: string };
  status: string;
  /** Older Stripe API versions keep the period end on the subscription. */
  current_period_end?: number;
  /** Newer ones keep it on each item. */
  items?: { data: { current_period_end?: number }[] };
}

export interface ProFields {
  stripe_customer_id: string;
  pro_status: string;
  pro_until: string | null;
}

export function proFields(sub: SubscriptionLike): ProFields {
  const end =
    sub.current_period_end ??
    Math.max(0, ...(sub.items?.data ?? []).map((i) => i.current_period_end ?? 0));
  return {
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    pro_status: sub.status,
    pro_until: end > 0 ? new Date(end * 1000).toISOString() : null,
  };
}

/** Lifetime PRO, from a paid one-time checkout. */
export function lifetimeFields(customer: string): ProFields {
  return { stripe_customer_id: customer, pro_status: LIFETIME, pro_until: null };
}

/** Lifetime outranks any subscription, so a later subscription event never takes it away. */
export const subscriptionMayUpdate = (currentStatus: string | null | undefined): boolean =>
  currentStatus !== LIFETIME;
