// The data export endpoint, against a fake Supabase.
import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type Handler, type Query, request } from "./fake-supabase.ts";

const mocks = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  handler: null as unknown as Handler,
  log: [] as Query[],
  signedIn: [] as boolean[],
}));

vi.mock("./supabase.ts", () => ({
  currentUser: async () => ({
    supabase: fakeClient((q) => mocks.handler(q), mocks.log),
    user: mocks.user,
  }),
  markSignedIn: (_ctx: unknown, v: boolean) => mocks.signedIn.push(v),
}));

const { GET } = await import("../pages/api/account/export.ts");
const ctx = () => ({ request: request("GET"), cookies: {} }) as unknown as APIContext;

const ROWS: Record<string, unknown> = {
  profiles: {
    pro_status: "active",
    pro_until: "2027-11-15T00:00:00Z",
    news: true,
    digest: false,
    daily: true,
    updated_at: "2026-11-01T00:00:00Z",
  },
  progress: [
    {
      exercise_id: "add-two-cells",
      entry: { state: "solved" },
      updated_at: "2026-11-15T10:00:00Z",
    },
  ],
  assessment_attempts: [{ id: "a1", assessment: "basics", score: 9, total: 10 }],
  daily_solves: [
    { day: "2026-11-15", exercise: "add-two-cells", solved_at: "2026-11-15T09:00:00Z" },
  ],
  free_drill_runs: [
    { day: "2026-11-15", slugs: ["sum-drill-1"], created_at: "2026-11-15T09:00:00Z" },
  ],
  mail_log: [{ kind: "daily:2026-11-15", sent_at: "2026-11-15T12:00:00Z" }],
  certificates: [{ id: "AAAAAAAAAAAAAAAAAAAAAA", name: "Ada Lovelace", revoked_at: null }],
};

beforeEach(() => {
  mocks.user = { id: "user-1", email: "ada@example.com", created_at: "2026-01-02T00:00:00Z" };
  mocks.handler = (q) => ({ data: ROWS[q.table] ?? null, error: null });
  mocks.log.length = 0;
  mocks.signedIn.length = 0;
});

describe("GET /api/account/export/", () => {
  it("refuses a signed-out visitor and reads nothing", async () => {
    mocks.user = null;
    const res = await GET(ctx());
    expect(res.status).toBe(401);
    expect(mocks.signedIn).toEqual([false]);
    expect(mocks.log).toEqual([]);
  });

  it("returns every section as a dated attachment", async () => {
    const res = await GET(ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="excelexercises-data-\d{4}-\d{2}-\d{2}\.json"$/u,
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["profile"]).toEqual({
      email: "ada@example.com",
      createdAt: "2026-01-02T00:00:00Z",
      proStatus: "active",
      proUntil: "2027-11-15T00:00:00Z",
      news: true,
      digest: false,
      daily: true,
      updatedAt: "2026-11-01T00:00:00Z",
    });
    for (const key of [
      "progress",
      "assessment_attempts",
      "daily_solves",
      "free_drill_runs",
      "mail_log",
      "certificates",
    ]) {
      expect(body[key]).toEqual(ROWS[key]);
    }
    expect(JSON.stringify(body)).not.toMatch(/stripe|user-1/u);
  });

  it("reads only the user's own rows", async () => {
    await GET(ctx());
    expect(mocks.log.map((q) => q.table).sort()).toEqual([
      "assessment_attempts",
      "certificates",
      "daily_solves",
      "free_drill_runs",
      "mail_log",
      "profiles",
      "progress",
    ]);
    for (const q of mocks.log) {
      expect(q.op).toBe("select");
      expect(q.filters).toEqual(q.table === "profiles" ? { id: "user-1" } : { user_id: "user-1" });
    }
  });

  it("gives no partial file when a table cannot be read", async () => {
    mocks.handler = (q) =>
      q.table === "daily_solves"
        ? { data: null, error: { message: "boom" } }
        : { data: ROWS[q.table] ?? null, error: null };
    const res = await GET(ctx());
    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Disposition")).toBeNull();
  });
});
