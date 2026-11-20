// The progress endpoint's DELETE, against a fake Supabase: it clears only the
// signed-in user's own rows, and says so when it cannot.
import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type Handler, type Query, request } from "./fake-supabase.ts";

const mocks = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  handler: null as unknown as Handler,
  log: [] as Query[],
}));

vi.mock("./supabase.ts", () => ({
  currentUser: async () => ({
    supabase: fakeClient((q) => mocks.handler(q), mocks.log),
    user: mocks.user,
  }),
}));

const { DELETE, GET } = await import("../pages/api/progress.ts");
const ctx = (method = "DELETE") =>
  ({ request: request(method), cookies: {} }) as unknown as APIContext;

beforeEach(() => {
  mocks.user = { id: "u1" };
  mocks.log = [];
  mocks.handler = () => ({ data: null, error: null });
});

describe("DELETE /api/progress/", () => {
  it("asks a signed-out visitor to sign in and touches nothing", async () => {
    mocks.user = null;
    expect((await DELETE(ctx())).status).toBe(401);
    expect(mocks.log).toEqual([]);
  });

  it("deletes the user's own progress rows and marks when", async () => {
    const res = await DELETE(ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cleared: true });
    expect(mocks.log[0]).toEqual({
      table: "progress",
      op: "delete",
      filters: { user_id: "u1" },
      single: false,
    });
    expect(mocks.log[1]).toMatchObject({ table: "profiles", op: "update", filters: { id: "u1" } });
    expect(mocks.log[1]?.payload).toHaveProperty("progress_cleared_at");
  });

  it("reports a failed delete", async () => {
    mocks.handler = () => ({ data: null, error: { message: "nope" } });
    expect((await DELETE(ctx())).status).toBe(500);
  });
});

describe("GET /api/progress/", () => {
  it("says when the progress was last cleared, so other devices drop their copy", async () => {
    mocks.handler = (q) =>
      q.table === "profiles"
        ? { data: { progress_cleared_at: "2026-11-19T10:00:00Z" }, error: null }
        : { data: [{ exercise_id: "add-two-cells", entry: { state: "solved" } }], error: null };
    const res = await GET(ctx("GET"));
    expect(res.headers.get("X-Progress-Cleared")).toBe("2026-11-19T10:00:00Z");
    expect(await res.json()).toEqual({ "add-two-cells": { state: "solved" } });
  });

  it("sends no clear mark when the progress was never cleared", async () => {
    mocks.handler = (q) =>
      q.table === "profiles" ? { data: null, error: null } : { data: [], error: null };
    expect((await GET(ctx("GET"))).headers.get("X-Progress-Cleared")).toBeNull();
  });
});
