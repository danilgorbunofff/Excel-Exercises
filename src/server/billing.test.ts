import { describe, expect, it } from "vitest";
import { hasPro } from "../lib/access.ts";
import { lifetimeFields, proFields, subscriptionMayUpdate } from "./billing.ts";

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
