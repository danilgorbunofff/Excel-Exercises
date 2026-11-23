import { describe, expect, it } from "vitest";
import { hasPro } from "../lib/access.ts";
import {
  cardFrom,
  lifetimeFields,
  paymentsFrom,
  planKeyFor,
  proFields,
  subscriptionMayUpdate,
} from "./billing.ts";

describe("proFields", () => {
  it("reads the period end from the subscription or its items", () => {
    expect(
      proFields({ customer: "cus_1", status: "active", current_period_end: 1_800_000_000 }),
    ).toEqual({
      stripe_customer_id: "cus_1",
      pro_status: "active",
      pro_until: "2027-01-15T08:00:00.000Z",
    });
    expect(
      proFields({
        customer: { id: "cus_2" },
        status: "trialing",
        items: { data: [{ current_period_end: 1_800_000_000 }] },
      }),
    ).toMatchObject({ stripe_customer_id: "cus_2", pro_until: "2027-01-15T08:00:00.000Z" });
  });

  it("a canceled subscription stops giving PRO", () => {
    const row = proFields({
      customer: "cus_1",
      status: "canceled",
      current_period_end: 1_800_000_000,
    });
    expect(hasPro(row, new Date("2026-06-01"))).toBe(false);
  });
});

describe("lifetime", () => {
  it("gives PRO with no end, and no subscription event replaces it", () => {
    const row = lifetimeFields("cus_9");
    expect(row).toEqual({ stripe_customer_id: "cus_9", pro_status: "lifetime", pro_until: null });
    expect(hasPro(row, new Date("2099-01-01"))).toBe(true);
    expect(subscriptionMayUpdate("lifetime")).toBe(false);
    expect(subscriptionMayUpdate("active")).toBe(true);
    expect(subscriptionMayUpdate(null)).toBe(true);
  });
});

describe("a member on the retired 6-month plan", () => {
  // Access reads the subscription's status and period end, never the plan, so
  // a 6-month subscription made before the change keeps unlocking PRO.
  const sub = {
    customer: "cus_old",
    status: "active",
    current_period_end: 1_800_000_000,
    items: { data: [{ current_period_end: 1_800_000_000, plan: { interval_count: 6 } }] },
  };

  it("still gives PRO until the paid period ends", () => {
    const row = proFields(sub);
    expect(row.pro_status).toBe("active");
    expect(hasPro(row, new Date("2026-12-01"))).toBe(true);
    expect(hasPro(row, new Date("2027-02-01"))).toBe(false);
    expect(subscriptionMayUpdate(row.pro_status)).toBe(true);
  });
});

describe("billing page mappers", () => {
  it("reads a card from a payment method or a charge", () => {
    expect(cardFrom({ brand: "visa", last4: "4242", exp_month: 8, exp_year: 2028 })).toEqual({
      brand: "visa",
      last4: "4242",
      expMonth: 8,
      expYear: 2028,
    });
    expect(cardFrom(null)).toBeNull();
    expect(cardFrom({ brand: "visa" })).toBeNull();
  });

  it("turns charges into payment rows", () => {
    expect(
      paymentsFrom([
        {
          created: 1_800_000_000,
          amount: 1500,
          currency: "usd",
          description: "Subscription update",
          status: "succeeded",
          receipt_url: "https://r",
        },
        {
          created: 1_800_000_000,
          amount: 12900,
          currency: "usd",
          status: "succeeded",
          refunded: true,
        },
        { created: 1_800_000_000, amount: 1500, currency: "usd", status: "failed" },
      ]).map((p) => [p.amountCents, p.status, p.description, p.receiptUrl]),
    ).toEqual([
      [1500, "paid", "Subscription update", "https://r"],
      [12900, "refunded", "PRO", null],
      [1500, "failed", "PRO", null],
    ]);
  });

  it("finds the plan key for a price id", () => {
    const prices: Record<string, string> = { monthly: "price_m", annual: "price_a" };
    const priceOf = (k: string) => prices[k] ?? null;
    expect(planKeyFor("price_a", ["monthly", "annual"], priceOf)).toBe("annual");
    expect(planKeyFor("price_x", ["monthly", "annual"], priceOf)).toBeNull();
    expect(planKeyFor(null, ["monthly"], priceOf)).toBeNull();
  });
});
