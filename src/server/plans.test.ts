import { describe, expect, it } from "vitest";
import {
  formatAmount,
  offeredPlans,
  perText,
  planFor,
  priceIdFor,
  savingPercent,
} from "./plans.ts";

describe("plans", () => {
  it("formats amounts and periods the way the pricing page shows them", () => {
    expect(formatAmount({ currency: "usd", unit_amount: 1500 })).toBe("$15");
    expect(formatAmount({ currency: "eur", unit_amount: 4950 })).toBe("€49.50");
    expect(perText({ recurring: null })).toBe("once");
    const r = (interval: "month" | "year", interval_count: number) =>
      ({ recurring: { interval, interval_count } }) as unknown as Parameters<typeof perText>[0];
    expect(perText(r("month", 1))).toBe("/ month");
    expect(perText(r("month", 3))).toBe("/ 3 months");
    expect(perText(r("year", 1))).toBe("/ year");
  });

  it("works out the saving against paying monthly", () => {
    expect(savingPercent(2900, 3, 1500)).toBe(35);
    expect(savingPercent(5900, 12, 1500)).toBe(67);
  });

  it("reads each plan's price id from its Vercel variable, and knows no other plan", () => {
    process.env["STRIPE_PRICE_SEMIANNUAL"] = "price_6m";
    expect(priceIdFor("semiannual")).toBe("price_6m");
    expect(priceIdFor("weekly")).toBeNull();
    expect(planFor("lifetime")?.env).toBe("STRIPE_PRICE_LIFETIME");
    delete process.env["STRIPE_PRICE_SEMIANNUAL"];
  });

  it("offers four plans, without the 6-month plan, which stays known", () => {
    expect(offeredPlans().map((p) => p.key)).toEqual([
      "monthly",
      "quarterly",
      "annual",
      "lifetime",
    ]);
    expect(offeredPlans().map((p) => p.listCents)).toEqual([1500, 2900, 5900, 12900]);
    expect(planFor("semiannual")?.sale).toBe(false);
  });

  it("drops lifetime on a keyed build when its price id is unset", () => {
    process.env["STRIPE_SECRET_KEY"] = "sk_test";
    expect(offeredPlans().map((p) => p.key)).not.toContain("lifetime");
    process.env["STRIPE_PRICE_LIFETIME"] = "price_life";
    expect(offeredPlans().map((p) => p.key)).toContain("lifetime");
    delete process.env["STRIPE_SECRET_KEY"];
    delete process.env["STRIPE_PRICE_LIFETIME"];
  });
});
