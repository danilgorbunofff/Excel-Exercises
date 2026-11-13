// Why this exists: the Content-Security-Policy in vercel.json allows only this
// site. Astro inlines small scripts and styles, and a few elements carry a
// style attribute, so the policy lists the SHA-256 hash of each one. These
// helpers find them in the built pages and write the policy, so the hashes
// never have to be typed by hand.
import { createHash } from "node:crypto";

export interface InlineHashes {
  scripts: string[];
  styles: string[];
  styleAttrs: string[];
}

/** The CSP source expression for a piece of inline text: 'sha256-<base64>'. */
export function cspHash(text: string): string {
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

// Data blocks are never run, so the policy does not cover them.
const DATA_BLOCK = /\btype="application\/(?:ld\+)?json"/u;
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/giu;
const STYLE = /<style\b[^>]*>([\s\S]*?)<\/style>/giu;
const STYLE_ATTR = /<[a-z][^\s>]*\s[^>]*?\bstyle="([^"]*)"/giu;

const decode = (value: string) =>
  value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

/** The sorted, unique hashes of every inline script, style element and style attribute. */
export function inlineHashes(pages: string | readonly string[]): InlineHashes {
  const scripts = new Set<string>();
  const styles = new Set<string>();
  const styleAttrs = new Set<string>();
  for (const html of typeof pages === "string" ? [pages] : pages) {
    for (const [, attrs = "", body = ""] of html.matchAll(SCRIPT)) {
      if (!/\bsrc=/u.test(attrs) && !DATA_BLOCK.test(attrs)) scripts.add(cspHash(body));
    }
    for (const [, body = ""] of html.matchAll(STYLE)) styles.add(cspHash(body));
    // Attributes are read from the markup only, not from script or style text.
    const markup = html.replace(SCRIPT, "").replace(STYLE, "");
    for (const [, value = ""] of markup.matchAll(STYLE_ATTR))
      styleAttrs.add(cspHash(decode(value)));
  }
  const sorted = (s: Set<string>) => [...s].sort();
  return { scripts: sorted(scripts), styles: sorted(styles), styleAttrs: sorted(styleAttrs) };
}

/** The whole policy: this site only, plus the inline hashes it needs. */
export function buildPolicy({ scripts, styles, styleAttrs }: InlineHashes): string {
  const styleSources =
    styleAttrs.length > 0 ? ["'unsafe-hashes'", ...styleAttrs, ...styles] : styles;
  return [
    "default-src 'self'",
    ["script-src 'self'", ...scripts].join(" "),
    ["style-src 'self'", ...styleSources].join(" "),
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
