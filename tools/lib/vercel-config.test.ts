// Checks vercel.json, which only Vercel reads: the local preview server
// ignores it, so its redirects and headers are tested here.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Redirect {
  source: string;
  destination: string;
  statusCode?: number;
  permanent?: boolean;
}
interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}
const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
  trailingSlash: boolean;
  redirects: Redirect[];
  headers: HeaderRule[];
};

/** Follows the first redirect whose source matches, as Vercel does for ":name" segments. */
function redirect(path: string): { to: string; status: number | undefined } | undefined {
  for (const r of config.redirects) {
    const names: string[] = [];
    const pattern = r.source.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/:(\w+)/gu, (_, n) => {
      names.push(n);
      return "([^/]+)";
    });
    const match = new RegExp(`^${pattern}$`, "u").exec(path);
    if (!match) continue;
    const to = names.reduce((d, n, i) => d.replaceAll(`:${n}`, match[i + 1] ?? ""), r.destination);
    return { to, status: r.statusCode };
  }
  return undefined;
}

const headersFor = (source: string) =>
  new Map(
    (config.headers.find((h) => h.source === source)?.headers ?? []).map((h) => [
      h.key.toLowerCase(),
      h.value,
    ]),
  );

describe("vercel.json", () => {
  it("serves addresses that end in a slash, as the build does", () => {
    expect(config.trailingSlash).toBe(true);
  });

  it("sends old topic addresses to the learning track with a 301", () => {
    for (const old of ["/topics/lookups/", "/topics/lookups"]) {
      expect(redirect(old), old).toEqual({ to: "/exercises/tracks/lookups/", status: 301 });
    }
    expect(redirect("/exercises/tracks/lookups/")).toBeUndefined();
  });

  it("sends the security headers on every path", () => {
    const all = headersFor("/(.*)");
    expect(all.get("content-security-policy")).toMatch(/^default-src 'self';/u);
    expect(all.get("content-security-policy")).not.toContain("unsafe-inline");
    expect(all.get("x-content-type-options")).toBe("nosniff");
    expect(all.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    for (const feature of ["camera=()", "microphone=()", "geolocation=()"]) {
      expect(all.get("permissions-policy")).toContain(feature);
    }
  });

  it("caches the hashed build assets for a year", () => {
    expect(headersFor("/_astro/(.*)").get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
  });
});
