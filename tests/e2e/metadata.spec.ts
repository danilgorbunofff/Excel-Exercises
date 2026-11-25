// Why this exists: every page must be complete without JavaScript, and its
// title and metadata must be the same after scripts run.
import { type Browser, expect, test } from "@playwright/test";
import { PRIVATE_PATHS } from "../../src/lib/routes.ts";
import { NOT_FOUND_PATH, sitemapRoutes } from "./routes.ts";

async function metadata(browser: Browser, url: string, javaScriptEnabled: boolean) {
  // Seeding localStorage needs script, so Firefox never finishes a script-free context with it.
  const context = await browser.newContext({
    javaScriptEnabled,
    ...(javaScriptEnabled ? {} : { storageState: { cookies: [], origins: [] } }),
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const result = {
    title: await page.title(),
    description: await page.locator('meta[name="description"]').getAttribute("content"),
    canonical: await page.locator('link[rel="canonical"]').getAttribute("href"),
    h1: await page.locator("h1").allInnerTexts(),
  };
  await context.close();
  return result;
}

const titles = new Map<string, string>();

for (const route of sitemapRoutes()) {
  test(`metadata survives scripts: ${route}`, async ({ browser, baseURL }) => {
    const url = new URL(route, baseURL).href;
    const withoutJs = await metadata(browser, url, false);
    const withJs = await metadata(browser, url, true);
    expect(withoutJs.title.length).toBeGreaterThan(0);
    expect(withoutJs.description?.length ?? 0).toBeGreaterThan(0);
    expect(withoutJs.canonical).toMatch(new RegExp(`${route.replace(/[/.]/gu, "\\$&")}$`, "u"));
    expect(withoutJs.h1).toHaveLength(1);
    expect(withJs).toEqual(withoutJs);
    titles.set(route, withoutJs.title);
  });
}

test.afterAll(() => {
  const seen = new Map<string, string>();
  for (const [route, title] of titles) {
    expect(
      seen.get(title),
      `"${title}" is used by ${seen.get(title)} and ${route}`,
    ).toBeUndefined();
    seen.set(title, route);
  }
});

test("unknown addresses get the 404 page with a 404 status", async ({ page }) => {
  const response = await page.goto(NOT_FOUND_PATH);
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page not found");
});

test("every page has share tags that match its title, description and canonical URL", async ({
  request,
}) => {
  // Text and attributes may escape the same character differently, such as an
  // apostrophe as &#39; in the title, so both sides are compared decoded.
  const decode = (s: string) =>
    s
      .replace(/&#(\d+);/gu, (_, n: string) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/giu, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 16)))
      .replaceAll("&quot;", '"')
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
  const attr = (html: string, pattern: RegExp) => {
    const raw = pattern.exec(html)?.[1];
    return raw === undefined ? undefined : decode(raw);
  };
  const meta = (html: string, key: string) =>
    attr(html, new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`, "u"));
  for (const route of sitemapRoutes()) {
    const html = await (await request.get(route)).text();
    const canonical = attr(html, /<link rel="canonical" href="([^"]+)"/u);
    expect(meta(html, "og:title"), route).toBe(attr(html, /<title>([^<]*)<\/title>/u));
    expect(meta(html, "og:description"), route).toBe(meta(html, "description"));
    expect(meta(html, "og:url"), route).toBe(canonical);
    expect(meta(html, "og:type"), route).toBe("website");
    expect(meta(html, "og:image"), route).toBe(new URL("/og.png", canonical).href);
    expect(meta(html, "twitter:card"), route).toBe("summary_large_image");
    expect(html, route).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png"');
    expect(meta(html, "robots"), route).toBeUndefined();
  }
});

test("the share image and the touch icon are PNGs of the right size", async ({ request }) => {
  for (const [path, width, height] of [
    ["/og.png", 1200, 630],
    ["/apple-touch-icon.png", 180, 180],
  ] as const) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(200);
    const png = await res.body();
    expect(png.subarray(1, 4).toString(), path).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)], path).toEqual([width, height]);
  }
});

test("private account pages are left out of search, Log in and Sign up are listed", async ({
  request,
}) => {
  const listed = sitemapRoutes();
  for (const route of PRIVATE_PATHS) {
    expect(listed, route).not.toContain(route);
    const html = await (await request.get(route)).text();
    expect(html, route).toContain('<meta name="robots" content="noindex">');
  }
  for (const route of ["/login/", "/register/", "/pricing/"])
    expect(listed, route).toContain(route);
});
