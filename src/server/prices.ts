// Why this exists: the PRO prices for the pricing page, read from Stripe when
// the site is built, so the page never shows a price Stripe would not charge.
// shortcut: a price change needs a redeploy; move to an on-demand read if prices change often.
// Without Stripe keys (local builds, CI, previews without Stripe variables) it
// returns null and the page says the price shows at checkout.
import Stripe from "stripe";
import { formatAmount, offeredPlans, type PlanKey, perText, priceIdFor } from "./plans.ts";

export interface Price {
  /** Formatted for display, such as "$15" or "€90". */
  amount: string;
  /** "/ month", "/ 3 months", "/ year" or "once". */
  per: string;
  /** The raw amount and currency, for per-month prices and savings. */
  cents: number;
  currency: string;
}

export async function proPrices(): Promise<Partial<Record<PlanKey, Price>> | null> {
  const key = process.env["STRIPE_SECRET_KEY"];
  const plans = offeredPlans();
  const ids = plans.map((p) => priceIdFor(p.key));
  if (!key || ids.some((id) => !id)) {
    console.warn("[pricing] Stripe key or a price id is missing: the page shows no amounts.");
    return null;
  }
  const s = new Stripe(key);
  const prices = await Promise.all(ids.map((id) => s.prices.retrieve(id ?? "")));
  return Object.fromEntries(
    plans.map((p, i) => {
      const price = prices[i] as Stripe.Price;
      return [
        p.key,
        {
          amount: formatAmount(price),
          per: perText(price),
          cents: price.unit_amount ?? 0,
          currency: price.currency,
        },
      ];
    }),
  ) as Partial<Record<PlanKey, Price>>;
}
