// The weekly job runs only for Vercel's cron call, which carries the secret.
import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase.ts", () => ({
  adminClient: () => {
    throw new Error("must not reach the database");
  },
}));

const { GET } = await import("../pages/api/cron/weekly.ts");

describe("GET /api/cron/weekly", () => {
  it("refuses a call without the cron secret", async () => {
    process.env["CRON_SECRET"] = "s3cret";
    const call = (auth?: string) =>
      GET({
        request: new Request("http://x.test/api/cron/weekly/", {
          headers: auth ? { authorization: auth } : {},
        }),
        url: new URL("http://x.test/api/cron/weekly/"),
      } as unknown as APIContext);
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
  });
});
