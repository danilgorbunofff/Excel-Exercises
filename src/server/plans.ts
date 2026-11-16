// Why this exists: the PRO plans and the Vercel variable that holds each
// Stripe price id. Recurring or one-time is read from the Stripe price itself,
// so a plan's billing changes in Stripe without a code change.
import type Stripe from "stripe";

// `listCents` (USD) is what the pricing page shows when the build has no Stripe
// keys; with keys it shows Stripe's own amounts, which should match.
export const PLANS = [
  { key: "monthly", label: "Monthly", env: "STRIPE_PRICE_MONTHLY", months: 1, listCents: 900 },
  {
    key: "semiannual",
    label: "Every 6 months",
    env: "STRIPE_PRICE_SEMIANNUAL",
    months: 6,
    listCents: 3900,
  },
  { key: "annual", label: "Yearly", env: "STRIPE_PRICE_ANNUAL", months: 12, listCents: 5900 },
  {
    key: "lifetime",
    label: "Lifetime",
    env: "STRIPE_PRICE_LIFETIME",
    months: null,
    listCents: null,
  },
] as const;

export type PlanKey = (typeof PLANS)[number]["key"];

export const planFor = (key: string) => PLANS.find((p) => p.key === key) ?? null;

/** The Stripe price id for a plan, or null when its variable is not set here. */
export const priceIdFor = (key: string): string | null => {
  const plan = planFor(key);
  return plan ? (process.env[plan.env] ?? null) : null;
};

/** "$9", "€90.50". */
export function formatAmount(p: Pick<Stripe.Price, "currency" | "unit_amount">): string {
  const cents = p.unit_amount ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: p.currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "/ month", "/ 6 months", "/ year", or "once" for a one-time price. */
export function perText(p: Pick<Stripe.Price, "recurring">): string {
  if (!p.recurring) return "once";
  const n = p.recurring.interval_count;
  return n === 1 ? `/ ${p.recurring.interval}` : `/ ${n} ${p.recurring.interval}s`;
}

/** Whole percent saved against paying monthly: 3900 over 6 months against 900 a month is 28. */
export const savingPercent = (cents: number, months: number, monthlyCents: number): number =>
  Math.floor((1 - cents / months / monthlyCents) * 100);
