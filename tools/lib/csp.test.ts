import { describe, expect, it } from "vitest";
import { buildPolicy, cspHash, inlineHashes } from "./csp.ts";

describe("cspHash", () => {
  it("is the base64 SHA-256 of the exact text, quoted as CSP expects", () => {
    expect(cspHash("")).toBe("'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='");
    expect(cspHash("a")).toBe("'sha256-ypeBEsobvcr6wjGzmiPcTaeG7/gUfE5yuYB3ha/uSLs='");
  });
});

describe("inlineHashes", () => {
  it("hashes inline scripts that run, and skips data blocks and external scripts", () => {
    const html = `<script type="module">a</script><script>a</script><script type="module" src="/x.js"></script><script type="application/ld+json">{}</script><script type="application/json">[]</script>`;
    expect(inlineHashes(html).scripts).toEqual([cspHash("a")]);
  });

  it("hashes inline style elements, also inside SVG", () => {
    const html = `<style>a</style><svg><style data-x>b{}</style></svg>`;
    expect(inlineHashes(html).styles).toEqual([cspHash("a"), cspHash("b{}")].sort());
  });

  it("hashes style attributes after decoding entities, and not text that only looks like one", () => {
    const html = `<span style="--box: 40px"></span><i style="a:&quot;b&quot;"></i><script>x=' style="no"'</script>`;
    expect(inlineHashes(html).styleAttrs).toEqual(
      [cspHash("--box: 40px"), cspHash('a:"b"')].sort(),
    );
  });

  it("merges several pages without repeats", () => {
    expect(inlineHashes(["<style>a</style>", "<style>a</style>"]).styles).toEqual([cspHash("a")]);
  });
});

describe("buildPolicy", () => {
  it("allows only this site, plus the listed inline hashes", () => {
    const policy = buildPolicy({ scripts: ["'sha256-s'"], styles: ["'sha256-t'"], styleAttrs: [] });
    expect(policy).toBe(
      "default-src 'self'; script-src 'self' 'sha256-s'; style-src 'self' 'sha256-t'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    );
  });

  it("adds 'unsafe-hashes' only when style attributes need it", () => {
    const policy = buildPolicy({ scripts: [], styles: ["'sha256-t'"], styleAttrs: ["'sha256-a'"] });
    expect(policy).toContain("style-src 'self' 'unsafe-hashes' 'sha256-a' 'sha256-t';");
    expect(policy).toContain("script-src 'self';");
  });
});
