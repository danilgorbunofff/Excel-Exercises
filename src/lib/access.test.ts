import { describe, expect, it } from "vitest";
import { hasPro, isLocked } from "./access.ts";

const at = (number: number, pro = false) => ({ exercise: { pro }, number });

describe("isLocked", () => {
  it("locks only pro exercises when every exercise is free", () => {
    expect(isLocked(at(50), null)).toBe(false);
    expect(isLocked(at(3, true), null)).toBe(true);
  });

  it("locks exercises after the free count, and pro ones before it", () => {
    expect(isLocked(at(10), 10)).toBe(false);
    expect(isLocked(at(11), 10)).toBe(true);
    expect(isLocked(at(2, true), 10)).toBe(true);
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
