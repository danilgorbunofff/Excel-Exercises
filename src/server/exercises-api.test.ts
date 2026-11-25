// The answers endpoint, against a fake Supabase: a free exercise's answers for
// anyone, a PRO exercise's only with PRO, and a held-out mock task's only with
// PRO and a saved attempt of a set that holds it, so a timed attempt cannot
// read its answers before it ends.
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
}));
const screen = (answer: string) => ({ screens: [{ answer }] });
vi.mock("../lib/exercises.ts", () => ({
  placedExercises: async () => [
    { exercise: { slug: "free-one", ...screen("=FREE()") }, topicNumber: 1 },
    { exercise: { slug: "pro-one", ...screen("=PRO()") }, topicNumber: 3 },
  ],
  // Ladder steps carry their exercise's place, so its lock.
  stepTasks: async () => [
    { exercise: { slug: "free-one-step-4", ...screen("=FREE4()") }, topicNumber: 1 },
    { exercise: { slug: "pro-one-step-2", ...screen("=PRO2()") }, topicNumber: 3 },
  ],
}));
// meeting-room-hours is a held-out task of the real "beginner" set.
vi.mock("astro:content", () => ({
  getCollection: async (name: string) =>
    name === "drills"
      ? [{ data: { slug: "sum-1", id: "sum-1", ...screen("=SUM(B2:B5)") } }]
      : [{ data: { slug: "meeting-room-hours", id: "meeting-room-hours", ...screen("=MOCK()") } }],
}));

const { GET } = await import("../pages/api/exercises/[slug].ts");
const call = (slug: string) =>
  GET({
    params: { slug },
    request: new Request("http://localhost/"),
    cookies: {},
  } as unknown as APIContext);
const pro = { pro_status: "active", pro_until: null };
const answer =
  (profile: unknown, attempts: unknown[]): Handler =>
  (q) =>
    q.table === "profiles"
      ? { data: profile, error: null }
      : { data: q.table === "free_drill_runs" ? null : attempts, error: null };

beforeEach(() => {
  mocks.user = { id: "user-1" };
  mocks.log.length = 0;
  mocks.handler = answer(null, []);
});

describe("GET /api/exercises/[slug]", () => {
  it("gives a free exercise's answers to anyone", async () => {
    mocks.user = null;
    const res = await call("free-one");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answers: ["=FREE()"] });
  });

  it("keeps a PRO exercise's answers from the signed out and from free accounts", async () => {
    mocks.user = null;
    expect((await call("pro-one")).status).toBe(401);
    mocks.user = { id: "user-1" };
    expect((await call("pro-one")).status).toBe(403);
    mocks.handler = answer(pro, []);
    expect(await (await call("pro-one")).json()).toEqual({ answers: ["=PRO()"] });
  });

  it("locks a ladder step exactly like its exercise", async () => {
    mocks.user = null;
    expect(await (await call("free-one-step-4")).json()).toEqual({ answers: ["=FREE4()"] });
    expect((await call("pro-one-step-2")).status).toBe(401);
    mocks.user = { id: "user-1" };
    expect((await call("pro-one-step-2")).status).toBe(403);
    mocks.handler = answer(pro, []);
    expect(await (await call("pro-one-step-2")).json()).toEqual({ answers: ["=PRO2()"] });
  });

  it("gives a drill's answers only with PRO, with no attempt needed", async () => {
    mocks.user = null;
    expect((await call("sum-1")).status).toBe(401);
    mocks.user = { id: "user-1" };
    expect((await call("sum-1")).status).toBe(403);
    mocks.handler = answer(pro, []);
    expect(await (await call("sum-1")).json()).toEqual({ answers: ["=SUM(B2:B5)"] });
    expect(mocks.log.some((q) => q.table === "assessment_attempts")).toBe(false);
  });

  it("gives a Free account a drill's answers only when it is in today's run", async () => {
    // The fake answers the run lookup: a row only when the slug is asked for as in the run.
    mocks.handler = (q) =>
      q.table === "profiles"
        ? { data: null, error: null }
        : {
            data: (q.filters["slugs"] as string[])?.includes("sum-1") ? { day: "today" } : null,
            error: null,
          };
    expect(await (await call("sum-1")).json()).toEqual({ answers: ["=SUM(B2:B5)"] });
    const asked = mocks.log.find((q) => q.table === "free_drill_runs");
    expect(asked?.filters).toMatchObject({ user_id: "user-1", slugs: ["sum-1"] });
    mocks.handler = () => ({ data: null, error: null });
    expect((await call("sum-1")).status).toBe(403);
    expect((await call("pro-one")).status).toBe(403);
  });

  it("keeps a mock task's answers until a set holding it is finished", async () => {
    mocks.user = null;
    expect((await call("meeting-room-hours")).status).toBe(401);
    mocks.user = { id: "user-1" };
    expect((await call("meeting-room-hours")).status).toBe(403);
    mocks.handler = answer(pro, []);
    expect((await call("meeting-room-hours")).status).toBe(403);
    const asked = mocks.log.find((q) => q.table === "assessment_attempts");
    expect(asked?.filters).toMatchObject({ user_id: "user-1", assessment: ["beginner"] });
    mocks.handler = answer(pro, [{ id: "a1" }]);
    expect(await (await call("meeting-room-hours")).json()).toEqual({ answers: ["=MOCK()"] });
  });

  it("is 404 for an unknown slug", async () => {
    expect((await call("no-such-task")).status).toBe(404);
  });
});
