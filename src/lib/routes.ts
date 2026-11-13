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
  "/profile/",
  "/forgot-password/",
  "/reset-password/",
  "/verify/",
  "/subscribe/",
] as const;

/** True for a page that search engines should not list: an account page while accounts are closed. */
export function hiddenFromSearch(path: string, accountsOpen: boolean): boolean {
  return !accountsOpen && (ACCOUNT_PATHS as readonly string[]).includes(path);
}
