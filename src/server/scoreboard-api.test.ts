// The scoreboard endpoint: the top of the week or of all time from the
// database function, with levels, and the learner's own row only when signed in.
import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type Handler, type Query } from "./fake-supabase.ts";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  userHandler: null as unknown as Handler,
  adminHandler: null as unknown as Handler,
  log: [] as Query[],
}));

vi.mock("./supabase.ts", () => ({
  currentUser: async () => ({
    supabase: fakeClient((q) => mocks.userHandler(q), mocks.log),
    user: mocks.user,
  }),
  adminClient: () => fakeClient((q) => mocks.adminHandler(q), mocks.log),
}));

const { GET } = await import("../pages/api/scoreboard.ts");
const call = (query = "") =>
  GET({
    request: new Request(`http://localhost/api/scoreboard/${query}`),
    cookies: {},
  } as unknown as APIContext);

beforeEach(() => {
  mocks.user = { id: "user-1" };
  mocks.log.length = 0;
  mocks.userHandler = () => ({ data: { nickname: null }, error: null });
  mocks.adminHandler = (q) =>
    q.table === "scoreboard"
      ? { data: [{ rank: 1, nickname: "anna_k", points: 120, total: 450 }], error: null }
      : { data: [{ points: 40, total: 90, rank: 4 }], error: null };
});

describe("GET /api/scoreboard/", () => {
  it("shows the week from Monday by default, with levels from all-time points", async () => {
    const body = await (await call()).json();
    expect(body.period).toBe("week");
    expect(body.top).toEqual([
      { rank: 1, nickname: "anna_k", points: 120, level: expect.objectContaining({ level: 4 }) },
    ]);
    const call0 = mocks.log.find((q) => q.table === "scoreboard");
    const since = (call0?.payload as { p_since: string } | undefined)?.p_since ?? "";
    expect(new Date(since).getUTCDay()).toBe(1);
    expect(body.me).toEqual({
      nickname: null,
      rank: 4,
      points: 40,
      total: 90,
      level: expect.objectContaining({ level: 1 }),
    });
  });

  it("reads all time on request, and has no own row when signed out", async () => {
    mocks.user = null;
    const body = await (await call("?period=all")).json();
    expect(body.period).toBe("all");
    expect(body.me).toBeNull();
    expect(mocks.log.map((q) => q.table)).toEqual(["scoreboard"]);
  });
});
