// Why this exists: the site must make no request to any other origin. This
// loads every route and fails on the first request that leaves the site.
import { expect, test } from "@playwright/test";
import { allRoutes } from "./routes.ts";

const LOCAL_SCHEMES = new Set(["data:", "blob:", "about:"]);

test("usage counts go to this site only, without cookies", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "").origin;
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/events/"));
  await page.goto("/");
  const request = await sent;
  expect(new URL(request.url()).origin).toBe(origin);
  expect(request.headers()["cookie"]).toBeUndefined();
  expect(request.postDataJSON()).toMatchObject({ name: "visit", path: "/" });
});

for (const route of allRoutes()) {
  test(`no third-party requests: ${route}`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL ?? "").origin;
    const offsite: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (!LOCAL_SCHEMES.has(url.protocol) && url.origin !== origin) offsite.push(request.url());
    });
    page.on("websocket", (ws) => offsite.push(ws.url()));
    await page.goto(route, { waitUntil: "networkidle" });
    expect(offsite).toEqual([]);
  });
}
