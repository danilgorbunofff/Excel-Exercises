// Why this exists: the canonical links, share tags, sitemap and robots file
// all carry absolute URLs built from siteConfig.url. A build made with the
// placeholder origin would look complete and point search engines and share
// previews at a domain nobody owns. These helpers find those URLs.

export interface EmittedUrl {
  kind: "canonical" | "og:url" | "og:image" | "sitemap" | "robots";
  url: string;
}

const PLACEHOLDER_HOSTS = ["example.com", "localhost", "127.0.0.1", "[::1]", "0.0.0.0"];

/** True when the URL's host is the placeholder domain (or a subdomain of it) or a local address. */
export function isPlaceholderUrl(url: string): boolean {
  const host = new URL(url).hostname;
  return PLACEHOLDER_HOSTS.some((p) => host === p || host.endsWith(`.${p}`));
}

const PATTERNS: { kind: EmittedUrl["kind"]; pattern: RegExp }[] = [
  { kind: "canonical", pattern: /<link[^>]+rel="canonical"[^>]*href="([^"]+)"/giu },
  { kind: "og:url", pattern: /<meta[^>]+property="og:url"[^>]*content="([^"]+)"/giu },
  { kind: "og:url", pattern: /<meta[^>]+content="([^"]+)"[^>]*property="og:url"/giu },
  { kind: "og:image", pattern: /<meta[^>]+property="og:image"[^>]*content="([^"]+)"/giu },
  { kind: "og:image", pattern: /<meta[^>]+content="([^"]+)"[^>]*property="og:image"/giu },
  { kind: "sitemap", pattern: /<loc>([^<]+)<\/loc>/giu },
  { kind: "robots", pattern: /^Sitemap:\s*(\S+)/gimu },
];

/** Every absolute URL in the text that a canonical link, share tag, sitemap or robots file emits. */
export function emittedUrls(text: string): EmittedUrl[] {
  const found: EmittedUrl[] = [];
  for (const { kind, pattern } of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const url = (match[1] ?? "").replaceAll("&amp;", "&");
      if (/^https?:\/\//iu.test(url)) found.push({ kind, url });
    }
  }
  return found;
}

/** The emitted URLs that point at the placeholder domain or a local address. */
export function placeholderUrls(text: string): EmittedUrl[] {
  return emittedUrls(text).filter((u) => isPlaceholderUrl(u.url));
}
