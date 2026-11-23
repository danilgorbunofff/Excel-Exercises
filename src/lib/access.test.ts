import { describe, expect, it } from "vitest";
import { hasPro, isLocked, planLine, topicNumbers } from "./access.ts";

describe("isLocked", () => {
  it("leaves the first ones in a track free and locks the rest", () => {
    expect(isLocked({ topicNumber: 1 }, 2)).toBe(false);
    expect(isLocked({ topicNumber: 2 }, 2)).toBe(false);
    expect(isLocked({ topicNumber: 3 }, 2)).toBe(true);
  });
});

describe("topicNumbers", () => {
  it("counts each track from 1 in track order", () => {
    const topic: Record<string, string> = { a: "x", b: "y", c: "x", d: "x" };
    const n = topicNumbers(["a", "b", "c", "d"], (id) => topic[id] ?? "");
    expect([...n]).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 2],
      ["d", 3],
    ]);
  });
});

describe("hasPro", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  it("needs an active status and a period that has not ended", () => {
    expect(hasPro(null, now)).toBe(false);
    expect(hasPro({ pro_status: null, pro_until: null }, now)).toBe(false);
    expect(hasPro({ pro_status: "canceled", pro_until: "2027-01-01" }, now)).toBe(false);
    expect(hasPro({ pro_status: "active", pro_until: "2026-05-01" }, now)).toBe(false);
    expect(hasPro({ pro_status: "active", pro_until: "2026-07-01" }, now)).toBe(true);
    expect(hasPro({ pro_status: "trialing", pro_until: null }, now)).toBe(true);
  });
});

describe("planLine", () => {
  it("says lifetime, past due or the renewal date", () => {
    expect(planLine({ proStatus: "lifetime", proUntil: null })).toMatch(/lifetime PRO/u);
    expect(planLine({ proStatus: "active", proUntil: null })).toBe("Your PRO plan is active.");
    expect(planLine({ proStatus: "active", proUntil: "2027-01-05T00:00:00Z" })).toBe(
      "Your PRO plan renews or ends on 5 January 2027.",
    );
    expect(planLine({ proStatus: "past_due", proUntil: "2027-01-05T00:00:00Z" })).toMatch(
      /^Your last payment failed/u,
    );
  });
});
