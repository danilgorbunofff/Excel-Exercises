// The free daily drill run, against a fake Supabase: signed out is refused, PRO
// is told to pick in the browser, and a Free account gets ten slugs on the first
// call and the same ten on every later call that day.
import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type Handler, type Query } from "./fake-supabase.ts";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  handler: null as unknown as Handler,
  log: [] as Query[],
}));

vi.mock("./supabase.ts", () => ({
  currentUser: async () => ({
    supabase: fakeClient((q) => mocks.handler(q), mocks.log),
    user: mocks.user,
  }),
  adminClient: () => fakeClient((q) => mocks.handler(q), mocks.log),
}));
vi.mock("astro:content", () => ({
  getCollection: async () =>
    Array.from({ length: 30 }, (_, i) => ({ data: { id: `d-${i}`, slug: `d-${i}` } })),
}));

const { GET, POST } = await import("../pages/api/drills/free-run.ts");
const call = (fn: typeof GET) =>
  fn({ request: new Request("http://localhost/"), cookies: {} } as unknown as APIContext);
const pro = { pro_status: "active", pro_until: null };

// A stand-in table: the first upsert stores its row, later ones keep the stored one.
let stored: { slugs: string[] } | null = null;
const database =
  (profile: unknown): Handler =>
  (q) => {
    if (q.table === "profiles") return { data: profile, error: null };
    if (q.op === "upsert") stored ??= { slugs: (q.payload as { slugs: string[] }).slugs };
    return { data: stored, error: null };
  };

beforeEach(() => {
  mocks.user = { id: "user-1" };
  mocks.log.length = 0;
  stored = null;
  mocks.handler = database(null);
});

describe("/api/drills/free-run", () => {
  it("refuses the signed out", async () => {
    mocks.user = null;
    expect((await call(GET)).status).toBe(401);
    expect((await call(POST)).status).toBe(401);
  });

  it("leaves PRO to pick in the browser", async () => {
    mocks.handler = database(pro);
    expect(await (await call(POST)).json()).toEqual({ pro: true });
    expect(mocks.log.some((q) => q.table === "free_drill_runs")).toBe(false);
  });

  it("makes ten slugs on the first call and returns the same ten after", async () => {
    expect(await (await call(GET)).json()).toEqual({ pro: false, today: null });
    const first = (await (await call(POST)).json()) as { slugs: string[] };
    expect(new Set(first.slugs).size).toBe(10);
    const saved = mocks.log.find((q) => q.op === "upsert");
    expect(saved?.options).toMatchObject({ onConflict: "user_id,day", ignoreDuplicates: true });
    expect(await (await call(POST)).json()).toEqual(first);
    expect(await (await call(GET)).json()).toEqual({ pro: false, today: first.slugs });
  });
});
