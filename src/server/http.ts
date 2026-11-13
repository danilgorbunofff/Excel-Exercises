// Why this exists: small helpers every /api/* function uses, so forms post,
// come back with a message, and never redirect off the site.

/** Redirects back to a page of this site with ?error= or ?ok=. */
export function back(to: string, message: { error: string } | { ok: string }): Response {
  const url = new URL(safePath(to), "http://x");
  for (const [k, v] of Object.entries(message)) url.searchParams.set(k, v);
  return new Response(null, { status: 303, headers: { Location: `${url.pathname}${url.search}` } });
}

export function redirect(to: string): Response {
  return new Response(null, { status: 303, headers: { Location: to } });
}

/** Keeps a redirect target on this site: a path starting with one slash, else "/". */
export function safePath(p: string | null | undefined, fallback = "/"): string {
  return p && /^\/(?!\/)/u.test(p) && !p.includes("\\") ? p : fallback;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Reads a form field as trimmed text. */
export function field(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
export const MIN_PASSWORD = 8;
