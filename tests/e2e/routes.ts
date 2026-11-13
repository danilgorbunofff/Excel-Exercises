// Why this exists: the list of routes every e2e check visits. It comes from the
// built sitemap, so a new page is tested without anyone adding it by hand.
import { readFileSync } from "node:fs";
import { ACCOUNT_PATHS } from "../../src/lib/routes.ts";

/** A path that matches no page, so the 404 page is tested too. */
export const NOT_FOUND_PATH = "/this-page-does-not-exist/";

export function sitemapRoutes(): string[] {
  const xml = readFileSync("dist/client/sitemap.xml", "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((m) => new URL(m[1] ?? "").pathname);
}

/**
 * Every page to visit: the sitemap, the account pages (the private ones are
 * kept out of the sitemap, but still served) and the 404 page.
 */
export const allRoutes = (): string[] => [
  ...new Set([...sitemapRoutes(), ...ACCOUNT_PATHS, NOT_FOUND_PATH]),
];
