// The solve endpoint, against a fake Supabase: it grades the formulas itself,
// pays only what lib/points.ts allows, keeps PRO content for PRO, and never
// pays the same first solve twice.
import type { GradeSpec } from "@practice/grader";
import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type Handler, type Query, request } from "./fake-supabase.ts";

const spec: GradeSpec = {
  rows: [[2], [5]],
  answerCell: "B1",
  expected: 7,
  requiredFunctions: [],
  forbiddenFunctions: [],
  requireReference: true,
};

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
vi.mock("./practice.ts", async (real) => ({
  ...(await real<typeof import("./practice.ts")>()),
  practiceTask: async (id: string) =>
    ({
      "free-one": {
        id,
        slug: id,
        kind: "exercise",
        item: id,
        level: 2,
        locked: false,
        specs: [spec],
      },
      "free-one-step-3": {
        id,
        slug: id,
        kind: "exercise",
        item: "free-one",
        level: 2,
        locked: false,
        specs: [spec],
      },
      "pro-one": {
        id,
        slug: id,
        kind: "exercise",
        item: id,
        level: 3,
        locked: true,
        specs: [spec],
      },
    })[id] ?? null,
}));
vi.mock("../lib/exercises.ts", () => ({ dailyTasks: async () => [] }));
vi.mock("astro:content", () => ({ getCollection: async () => [] }));

const { POST } = await import("../pages/api/solves.ts");
const today = new Date().toISOString().slice(0, 10);
const call = (body: unknown) =>
  POST({ request: request("POST", body), cookies: {} } as unknown as APIContext);
const solve = (id: string, extra: Record<string, unknown> = {}) =>
  call({ id, formulas: ["=A1+A2"], helped: false, day: today, ...extra });

let ledger: Record<string, unknown>[] = [];
beforeEach(() => {
  mocks.user = { id: "user-1" };
  mocks.log.length = 0;
  ledger = [];
  mocks.userHandler = () => ({ data: null, error: null });
  mocks.adminHandler = (q) => {
    if (q.op === "rpc") return { data: [{ points: 0, total: 20, rank: null }], error: null };
    if (q.op === "insert") {
      const rows = q.payload as Record<string, unknown>[];
      const dup = rows.some((r) =>
        ledger.some((l) => l["item"] === r["item"] && l["kind"] === r["kind"]),
      );
      if (dup) return { data: null, error: { code: "23505" } };
      ledger.push(...rows);
      return { data: null, error: null };
    }
    return { data: ledger.filter((l) => l["item"] === q.filters["item"]), error: null };
  };
});

const inserts = () => mocks.log.filter((q) => q.op === "insert");

describe("POST /api/solves/", () => {
  it("needs an account", async () => {
    mocks.user = null;
    expect((await solve("free-one")).status).toBe(401);
  });

  it("pays a first solve it graded itself, once", async () => {
    const res = await solve("free-one");
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      earned: [{ kind: "solve", points: 20 }],
      total: 20,
      level: { level: 1 },
    });
    expect(inserts()[0]?.payload).toEqual([
      { item: "free-one", kind: "solve", day: today, points: 20, user_id: "user-1" },
    ]);
    const again = await solve("free-one");
    expect(again.status).toBe(200);
    expect((await again.json()).earned).toEqual([]);
  });

  it("counts a ladder step as its exercise", async () => {
    await solve("free-one-step-3", { helped: true });
    expect(ledger).toEqual([
      { item: "free-one", kind: "solve", day: today, points: 10, user_id: "user-1" },
    ]);
    expect((await (await solve("free-one")).json()).earned).toEqual([]);
  });

  it("refuses a wrong formula and a missing screen", async () => {
    expect((await solve("free-one", { formulas: ["=A1"] })).status).toBe(422);
    expect((await solve("free-one", { formulas: [] })).status).toBe(422);
    expect(inserts()).toEqual([]);
  });

  it("keeps PRO content for PRO", async () => {
    expect((await solve("pro-one")).status).toBe(403);
    mocks.userHandler = (q) =>
      q.table === "profiles"
        ? { data: { pro_status: "active", pro_until: null }, error: null }
        : { data: null, error: null };
    expect((await solve("pro-one")).status).toBe(201);
  });

  it("refuses days far from today, unknown tasks and bad bodies", async () => {
    expect((await solve("free-one", { day: "2026-01-01" })).status).toBe(400);
    expect((await solve("free-one", { day: "not a day" })).status).toBe(400);
    expect((await solve("nope")).status).toBe(404);
    expect((await call({ id: "free-one" })).status).toBe(400);
  });
});
