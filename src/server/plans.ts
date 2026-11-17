// Why this exists: the PRO plans and the Vercel variable that holds each
// Stripe price id. Recurring or one-time is read from the Stripe price itself,
// so a plan's billing changes in Stripe without a code change.
import type Stripe from "stripe";
import { siteConfig } from "../../site.config.ts";

// `listCents` (USD) is what the pricing page shows when the build has no Stripe
// keys; with keys it shows Stripe's own amounts, which should match.
// `sale: false` keeps a plan known (webhook, billing, account page) but takes it
// off the pricing page and out of checkout: members already on it keep it.
export const PLANS = [
  {
    key: "monthly",
    label: "Monthly",
    env: "STRIPE_PRICE_MONTHLY",
    months: 1,
    listCents: 1500,
    sale: true,
  },
  {
    key: "quarterly",
    label: "Every 3 months",
    env: "STRIPE_PRICE_QUARTERLY",
    months: 3,
    listCents: 2900,
    sale: true,
  },
  {
    key: "semiannual",
    label: "Every 6 months",
    env: "STRIPE_PRICE_SEMIANNUAL",
    months: 6,
    listCents: 3900,
    sale: false,
  },
  {
    key: "annual",
    label: "Yearly",
    env: "STRIPE_PRICE_ANNUAL",
    months: 12,
    listCents: 5900,
    sale: true,
  },
  {
    key: "lifetime",
    label: "Lifetime",
    env: "STRIPE_PRICE_LIFETIME",
    months: null,
    listCents: 12900,
    sale: true,
  },
] as const;

export type PlanKey = (typeof PLANS)[number]["key"];

export const planFor = (key: string) => PLANS.find((p) => p.key === key) ?? null;

/**
 * The plans a visitor can buy now. Lifetime is a launch offer: it goes when
 * `lifetimeOffer` in site.config.ts is false, or, on a build with Stripe keys,
 * when STRIPE_PRICE_LIFETIME is unset.
 */
export const offeredPlans = () =>
  PLANS.filter(
    (p) =>
      p.sale &&
      (p.key !== "lifetime" ||
        (siteConfig.lifetimeOffer && (!process.env["STRIPE_SECRET_KEY"] || priceIdFor(p.key)))),
  );

/** The Stripe price id for a plan, or null when its variable is not set here. */
export const priceIdFor = (key: string): string | null => {
  const plan = planFor(key);
  return plan ? (process.env[plan.env] ?? null) : null;
};

/** "$15", "€90.50". */
export function formatAmount(p: Pick<Stripe.Price, "currency" | "unit_amount">): string {
  const cents = p.unit_amount ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: p.currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "/ month", "/ 3 months", "/ year", or "once" for a one-time price. */
export function perText(p: Pick<Stripe.Price, "recurring">): string {
  if (!p.recurring) return "once";
  const n = p.recurring.interval_count;
  return n === 1 ? `/ ${p.recurring.interval}` : `/ ${n} ${p.recurring.interval}s`;
}

/** Whole percent saved against paying monthly: 2900 over 3 months against 1500 a month is 35. */
export const savingPercent = (cents: number, months: number, monthlyCents: number): number =>
  Math.floor((1 - cents / months / monthlyCents) * 100);
