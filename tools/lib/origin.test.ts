import { describe, expect, it } from "vitest";
import { emittedUrls, isPlaceholderUrl, placeholderUrls } from "./origin.ts";

describe("isPlaceholderUrl", () => {
  it("flags the placeholder domain and local addresses", () => {
    for (const url of [
      "https://example.com/",
      "https://www.example.com/og.png",
      "http://localhost:4321/exercises/",
      "http://127.0.0.1/",
      "http://[::1]:8080/",
    ]) {
      expect(isPlaceholderUrl(url), url).toBe(true);
    }
  });

  it("accepts a real domain, even one that contains a placeholder word", () => {
    for (const url of [
      "https://formulapractice.com/",
      "https://notexample.com/",
      "https://example.com.au/",
      "https://localhost.dev.example.org/",
    ]) {
      expect(isPlaceholderUrl(url), url).toBe(false);
    }
  });
});

describe("emittedUrls", () => {
  it("finds the canonical link, share tags, sitemap entries and the robots sitemap line", () => {
    const html = `<link rel="canonical" href="https://a.test/x/"><meta property="og:url" content="https://a.test/x/"><meta property="og:image" content="https://a.test/og.png"><meta content="https://b.test/" property="og:url">`;
    expect(emittedUrls(html)).toEqual([
      { kind: "canonical", url: "https://a.test/x/" },
      { kind: "og:url", url: "https://a.test/x/" },
      { kind: "og:url", url: "https://b.test/" },
      { kind: "og:image", url: "https://a.test/og.png" },
    ]);
    expect(emittedUrls("<url><loc>https://a.test/</loc></url>")).toEqual([
      { kind: "sitemap", url: "https://a.test/" },
    ]);
    expect(emittedUrls("User-agent: *\nSitemap: https://a.test/sitemap.xml\n")).toEqual([
      { kind: "robots", url: "https://a.test/sitemap.xml" },
    ]);
  });

  it("ignores links that are not canonical and relative addresses", () => {
    expect(
      emittedUrls(`<link rel="icon" href="https://example.com/i.svg"><a href="/x/">x</a>`),
    ).toEqual([]);
  });
});

describe("placeholderUrls", () => {
  it("returns only the URLs that point at a placeholder origin", () => {
    const html = `<link rel="canonical" href="https://example.com/x/"><meta property="og:image" content="https://formulapractice.com/og.png">`;
    expect(placeholderUrls(html)).toEqual([{ kind: "canonical", url: "https://example.com/x/" }]);
  });
});
