import { describe, expect, it } from "vitest";
import { cleanEvent } from "./events.ts";

describe("cleanEvent", () => {
  it("keeps a known event, its path without the query and the tab id", () => {
    expect(
      cleanEvent({ name: "first_solve", path: "/exercises/sum/?email=a@b.c#x", tab: "abc-1234" }),
    ).toEqual({ name: "first_solve", path: "/exercises/sum/", tab: "abc-1234" });
    expect(cleanEvent({ name: "visit" })).toEqual({ name: "visit", path: null, tab: null });
  });

  it("refuses unknown names, offsite paths and odd tab ids", () => {
    for (const bad of [
      null,
      "visit",
      {},
      { name: "made_up" },
      { name: "visit", path: "//evil.com" },
      { name: "visit", path: "https://evil.com" },
      { name: "visit", path: 3 },
      { name: "visit", tab: "short" },
      { name: "visit", tab: "has space in it" },
    ]) {
      expect(cleanEvent(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("cuts a long path", () => {
    expect(cleanEvent({ name: "visit", path: `/${"a".repeat(500)}` })?.path).toHaveLength(200);
  });
});
