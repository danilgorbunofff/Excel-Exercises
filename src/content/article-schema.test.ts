import { describe, expect, it } from "vitest";
import { articleSchema } from "./schema.ts";

const base = { title: "T", description: "D", updated: "2026-11-11", minutes: 4 };

describe("article cover", () => {
  it("is optional", () => {
    expect(articleSchema.parse(base).cover).toBeUndefined();
  });
  it("keeps a short piece of formula text", () => {
    expect(articleSchema.parse({ ...base, cover: "$A$1" }).cover).toBe("$A$1");
  });
  it("rejects text too long to fit the cover", () => {
    expect(articleSchema.safeParse({ ...base, cover: "=VLOOKUP(A2,D2:F20,3,FALSE)" }).success).toBe(
      false,
    );
  });
});
