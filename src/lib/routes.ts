// Why this exists: turns page file paths into public URLs, so the sitemap is
// derived from the pages that exist and cannot drift from them.

/** Maps "./foo/index.astro" style keys to "/foo/" routes, skipping 404 and dynamic pages. */
export function routesFromPageFiles(files: readonly string[]): string[] {
  return files
    .filter((f) => !f.includes("[") && !f.endsWith("/404.astro"))
    .map((f) =>
      f
        .replace(/^\.\//, "/")
        .replace(/\.astro$/, "")
        .replace(/(^|\/)index$/, "$1"),
    )
    .map((p) => (p.endsWith("/") ? p : `${p}/`))
    .sort();
}

/** The account pages. They need a server, so they stay out of search until accounts open. */
export const ACCOUNT_PATHS = [
  "/login/",
  "/register/",
  "/account/",
  "/account/progress/",
  "/account/daily/",
  "/account/certificates/",
  "/account/billing/",
  "/account/settings/",
  "/forgot-password/",
  "/reset-password/",
  "/verify/",
  "/subscribe/",
] as const;

/** Account pages that only make sense for one visitor, so search never lists them. */
export const PRIVATE_PATHS = [
  "/account/",
  "/account/progress/",
  "/account/daily/",
  "/account/certificates/",
  "/account/billing/",
  "/account/settings/",
  "/reset-password/",
  "/verify/",
  "/subscribe/",
] as const satisfies readonly (typeof ACCOUNT_PATHS)[number][];

/**
 * True for a page that search engines should not list: every account page
 * while accounts are closed, and the private ones always.
 */
export function hiddenFromSearch(path: string, accountsOpen: boolean): boolean {
  // A certificate page is for whoever has the link, never for search.
  if (path.startsWith("/certificates/")) return true;
  // A function drill page is a step of a practice session, not a landing page.
  if (/^\/exercises\/drills\/[^/]+\/$/u.test(path)) return true;
  // A ladder step is a harder or easier take on its exercise, which is the page to find.
  if (/^\/exercises\/[^/]+\/[1-5]\/$/u.test(path)) return true;
  const list: readonly string[] = accountsOpen ? PRIVATE_PATHS : ACCOUNT_PATHS;
  return list.includes(path);
}
