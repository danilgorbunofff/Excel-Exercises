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

/** The card shown on the billing page. */
export interface BillingCard {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

/** One row of payment history. */
export interface BillingPayment {
  /** ISO time the charge was made. */
  date: string;
  amountCents: number;
  currency: string;
  description: string;
  /** "paid", "refunded" or "failed". */
  status: string;
  receiptUrl: string | null;
}

/** What /api/billing/ answers. */
export interface BillingInfo {
  /** A PLANS key, or null for no plan (free) or a price this build does not know. */
  plan: string | null;
  /** ISO end of the paid period for a subscription, else null. */
  renews: string | null;
  /** True when the subscription is set to end at `renews` instead of renewing. */
  ending: boolean;
  card: BillingCard | null;
  payments: BillingPayment[];
}

/** The parts of a Stripe card this site reads, from a payment method or a charge. */
interface CardLike {
  brand?: string | null;
  last4?: string | null;
  exp_month?: number | null;
  exp_year?: number | null;
}

export function cardFrom(card: CardLike | null | undefined): BillingCard | null {
  if (!card?.last4) return null;
  return {
    brand: card.brand ?? "card",
    last4: card.last4,
    expMonth: card.exp_month ?? 0,
    expYear: card.exp_year ?? 0,
  };
}

/** The parts of a Stripe charge this site reads. */
export interface ChargeLike {
  created: number;
  amount: number;
  amount_refunded?: number;
  currency: string;
  description?: string | null;
  status: string;
  paid?: boolean;
  refunded?: boolean;
  receipt_url?: string | null;
}

export function paymentsFrom(charges: readonly ChargeLike[]): BillingPayment[] {
  return charges.map((c) => ({
    date: new Date(c.created * 1000).toISOString(),
    amountCents: c.amount,
    currency: c.currency,
    description: c.description || "PRO",
    status: c.refunded ? "refunded" : c.status === "succeeded" ? "paid" : "failed",
    receiptUrl: c.receipt_url ?? null,
  }));
}

/** The PLANS key whose price id is this one, read through `priceOf` (priceIdFor in plans.ts). */
export function planKeyFor(
  priceId: string | null | undefined,
  keys: readonly string[],
  priceOf: (key: string) => string | null,
): string | null {
  if (!priceId) return null;
  return keys.find((k) => priceOf(k) === priceId) ?? null;
}
