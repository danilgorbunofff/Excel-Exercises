import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { currentHref, LEARN_NAV, PRACTICE_NAV, PRICING_NAV, SUPPORT_NAV, YOU_NAV } from "./nav.ts";
import { ACCOUNT_PATHS, routesFromPageFiles } from "./routes.ts";

const pages = readdirSync("src/pages", { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".astro"))
  .map((f) => `./${f}`);
const routes = new Set(routesFromPageFiles(pages));
const all = [...PRACTICE_NAV, ...LEARN_NAV, PRICING_NAV, ...SUPPORT_NAV, ...YOU_NAV];

describe("nav", () => {
  it("links only to pages that exist", () => {
    for (const { href } of all) expect(routes.has(href.split("#")[0] ?? ""), href).toBe(true);
  });

  it("leaves no public section out", () => {
    const linked = new Set(all.map((i) => i.href.split("#")[0]));
    // The home page, search (in the header box) and contact (in the footer) are reached otherwise.
    const reachedOtherwise = new Set<string>(["/", "/search/", "/contact/", ...ACCOUNT_PATHS]);
    const sections = [...routes].filter((r) => r.split("/").length === 3);
    for (const r of sections) {
      if (!reachedOtherwise.has(r)) expect(linked.has(r), r).toBe(true);
    }
  });

  it("gives every item a short description", () => {
    for (const item of [...PRACTICE_NAV, ...LEARN_NAV]) {
      expect(item.description.length, item.label).toBeGreaterThan(10);
      expect(item.description.length, item.label).toBeLessThanOrEqual(80);
    }
  });
});

describe("currentHref", () => {
  it("picks the longest matching item", () => {
    expect(currentHref(PRACTICE_NAV, "/exercises/")).toBe("/exercises/");
    expect(currentHref(PRACTICE_NAV, "/exercises/sum-a-column/")).toBe("/exercises/");
    expect(currentHref(PRACTICE_NAV, "/exercises/tracks/")).toBe("/exercises/tracks/");
    expect(currentHref(PRACTICE_NAV, "/exercises/tracks/lookups/")).toBe("/exercises/tracks/");
    expect(currentHref(PRACTICE_NAV, "/daily/")).toBe("/daily/");
    expect(currentHref(LEARN_NAV, "/functions/xlookup/")).toBe("/functions/");
  });

  it("is null outside the group, and never picks a link to a place in a page", () => {
    expect(currentHref(PRACTICE_NAV, "/functions/")).toBeNull();
    expect(currentHref(LEARN_NAV, "/")).toBeNull();
    expect(currentHref([{ href: "/a/#b" }], "/a/")).toBeNull();
  });
});
