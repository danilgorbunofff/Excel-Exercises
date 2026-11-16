import { describe, expect, it } from "vitest";
import { formatAmount, perText, planFor, priceIdFor, savingPercent } from "./plans.ts";

describe("plans", () => {
  it("formats amounts and periods the way the pricing page shows them", () => {
    expect(formatAmount({ currency: "usd", unit_amount: 900 })).toBe("$9");
    expect(formatAmount({ currency: "eur", unit_amount: 4950 })).toBe("€49.50");
    expect(perText({ recurring: null })).toBe("once");
    const r = (interval: "month" | "year", interval_count: number) =>
      ({ recurring: { interval, interval_count } }) as unknown as Parameters<typeof perText>[0];
    expect(perText(r("month", 1))).toBe("/ month");
    expect(perText(r("month", 6))).toBe("/ 6 months");
    expect(perText(r("year", 1))).toBe("/ year");
  });

  it("works out the saving against paying monthly", () => {
    expect(savingPercent(3900, 6, 900)).toBe(27);
    expect(savingPercent(5900, 12, 900)).toBe(45);
  });

  it("reads each plan's price id from its Vercel variable, and knows no other plan", () => {
    process.env["STRIPE_PRICE_SEMIANNUAL"] = "price_6m";
    expect(priceIdFor("semiannual")).toBe("price_6m");
    expect(priceIdFor("weekly")).toBeNull();
    expect(planFor("lifetime")?.env).toBe("STRIPE_PRICE_LIFETIME");
    delete process.env["STRIPE_PRICE_SEMIANNUAL"];
  });
});
