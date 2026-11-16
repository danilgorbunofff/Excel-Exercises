// The issuing endpoint and the attempt endpoint, against a fake Supabase.
import type { GradeSpec } from "@practice/grader";
import type { APIContext } from "astro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CERTIFICATE_ID } from "../lib/certificates.ts";
import { fakeClient, type Handler, type Query, request } from "./fake-supabase.ts";

const spec = (expected: number): GradeSpec => ({
  rows: [[2], [5]],
  answerCell: "B1",
  expected,
  requiredFunctions: [],
  forbiddenFunctions: [],
  requireReference: true,
});

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
// Every task is "=A1+A2" = 7 in B1, so the formulas decide the score.
vi.mock("./assessment-specs.ts", () => ({ loadSpecs: async () => () => spec(7) }));

const { GET, POST, PATCH } = await import("../pages/api/certificates.ts");
const attempts = await import("../pages/api/assessments.ts");
const { loadAssessments } = await import("../lib/assessments.ts");

const set = loadAssessments().sets.find((s) => !s.sample);
if (!set) throw new Error("no PRO set");
const n = set.tasks.length;
const pass = Math.ceil((n * 4) / 5);
const formulas = (right: number) =>
  Array.from({ length: n }, (_, i) => (i < right ? "=A1+A2" : "=1"));

const ctx = (req: Request) => ({ request: req, cookies: {} }) as unknown as APIContext;
const ATTEMPT_ID = "11111111-2222-4333-8444-555555555555";
const pro = { pro_status: "active", pro_until: null };
const stored = (right: number, score = right) => ({
  id: ATTEMPT_ID,
  assessment: set.slug,
  score,
  total: n,
  time_limit_s: set.minutes * 60,
  server_started_at: "2026-11-15T10:00:00.000Z",
  received_at: "2026-11-15T10:20:00.000Z",
  formulas: formulas(right),
});
const issued = {
  id: "AAAAAAAAAAAAAAAAAAAAAA",
  name: "Ada Lovelace",
  assessment: set.slug,
  assessment_title: set.title,
  score: n,
  total: n,
  time_limit_s: set.minutes * 60,
  issued_at: "2026-11-15T10:21:00.000Z",
  revoked_at: null,
};

/** The user's own reads: the profile and the attempt. */
const ownRows =
  (attempt: unknown, profile: unknown = pro): Handler =>
  (q) =>
    q.table === "profiles" ? { data: profile, error: null } : { data: attempt, error: null };

beforeEach(() => {
  mocks.user = { id: "user-1" };
  mocks.log.length = 0;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-key";
});

describe("POST /api/certificates/", () => {
  const claim = (body: unknown = { attempt: ATTEMPT_ID, name: " Ada  Lovelace " }) =>
    POST(ctx(request("POST", body)));

  it("refuses a signed-out visitor", async () => {
    mocks.user = null;
    expect((await claim()).status).toBe(401);
  });

  it("re-grades the stored formulas and issues through the service role", async () => {
    mocks.userHandler = ownRows(stored(n));
    mocks.adminHandler = (q) =>
      q.op === "insert"
        ? { data: { ...issued, ...(q.payload as object) }, error: null }
        : { data: null, error: null };
    const res = await claim();
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; url: string; name: string };
    expect(body.id).toMatch(CERTIFICATE_ID);
    expect(body.url).toBe(`/certificates/${body.id}/`);
    const insert = mocks.log.find((q) => q.op === "insert");
    expect(insert?.table).toBe("certificates");
    expect(insert?.payload).toMatchObject({
      user_id: "user-1",
      attempt_id: ATTEMPT_ID,
      name: "Ada Lovelace",
      score: n,
      total: n,
      assessment_title: set.title,
    });
  });

  it("passes exactly at the mark and refuses one below", async () => {
    mocks.adminHandler = (q) =>
      q.op === "insert" ? { data: issued, error: null } : { data: null, error: null };
    mocks.userHandler = ownRows(stored(pass));
    expect((await claim()).status).toBe(201);
    mocks.userHandler = ownRows(stored(pass - 1));
    const low = await claim();
    expect(low.status).toBe(403);
    expect(await low.json()).toEqual({ error: "below the pass mark" });
  });

  it("refuses when the stored score does not match the re-grade", async () => {
    // The row claims a full score, but the stored formulas are only half right.
    mocks.userHandler = ownRows(stored(Math.floor(n / 2), n));
    mocks.adminHandler = () => ({ data: null, error: null });
    const res = await claim();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "re-grade mismatch" });
    expect(mocks.log.some((q) => q.op === "insert")).toBe(false);
  });

  it("returns the existing live certificate instead of a second one", async () => {
    mocks.userHandler = ownRows(stored(n));
    mocks.adminHandler = () => ({ data: issued, error: null });
    const res = await claim();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }).id).toBe(issued.id);
    expect(mocks.log.some((q) => q.op === "insert")).toBe(false);
  });

  it("returns the other request's certificate when an insert races it", async () => {
    mocks.userHandler = ownRows(stored(n));
    let selects = 0;
    mocks.adminHandler = (q) => {
      if (q.op === "insert") return { data: null, error: { code: "23505" } };
      selects += 1;
      return { data: selects === 1 ? null : issued, error: null };
    };
    const res = await claim();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }).id).toBe(issued.id);
  });

  it("refuses without PRO, an untimed run, an unknown attempt and a bad name", async () => {
    mocks.adminHandler = () => ({ data: null, error: null });
    mocks.userHandler = ownRows(stored(n), { pro_status: null, pro_until: null });
    expect((await claim()).status).toBe(403);
    mocks.userHandler = ownRows({ ...stored(n), time_limit_s: null });
    expect((await claim()).status).toBe(403);
    mocks.userHandler = ownRows(null);
    expect((await claim()).status).toBe(404);
    expect((await claim({ attempt: "x", name: "Ada" })).status).toBe(404);
    mocks.userHandler = ownRows(stored(n));
    expect((await claim({ attempt: ATTEMPT_ID, name: "<b>" })).status).toBe(400);
  });
});

describe("GET and PATCH /api/certificates/", () => {
  it("lists the user's own certificates", async () => {
    mocks.userHandler = () => ({ data: [issued], error: null });
    const res = await GET(ctx(request("GET")));
    expect(await res.json()).toEqual([issued]);
    expect(mocks.log[0]?.table).toBe("certificates");
  });

  it("revokes a live certificate as the user, and 404s on an unknown one", async () => {
    mocks.userHandler = (q) => ({
      data: [{ id: issued.id, revoked_at: (q.payload as { revoked_at: string }).revoked_at }],
      error: null,
    });
    const res = await PATCH(ctx(request("PATCH", { id: issued.id })));
    expect(res.status).toBe(200);
    expect(mocks.log[0]).toMatchObject({
      table: "certificates",
      op: "update",
      filters: { id: issued.id, revoked_at: null },
    });
    mocks.userHandler = () => ({ data: [], error: null });
    expect((await PATCH(ctx(request("PATCH", { id: issued.id })))).status).toBe(404);
    expect((await PATCH(ctx(request("PATCH", { id: "nope" })))).status).toBe(404);
  });
});

describe("POST /api/assessments/", () => {
  const body = {
    assessment: set.slug,
    startedAt: "2026-11-15T10:00:00.000Z",
    finishedAt: "2026-11-15T10:20:00.000Z",
    timeLimit: set.minutes * 60,
    // Claims every task right; the server marks the formulas instead.
    results: set.tasks.map((t) => ({ ...t, correct: true, rule: null })),
    formulas: formulas(1),
    startToken: null,
  };

  it("stores the server's marks and formulas, not the browser's, through the service role", async () => {
    mocks.userHandler = ownRows(null);
    mocks.adminHandler = () => ({ data: { id: ATTEMPT_ID }, error: null });
    const res = await attempts.POST(ctx(request("POST", body)));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: ATTEMPT_ID, score: 1, total: n });
    const insert = mocks.log.find((q) => q.op === "insert");
    expect(insert?.payload).toMatchObject({
      score: 1,
      total: n,
      formulas: formulas(1),
      server_started_at: null,
    });
  });

  it("stamps the server start from a valid token for this user and set", async () => {
    const { startToken } = await import("./start-token.ts");
    const { env } = await import("./env.ts");
    const started = Date.now() - 60_000;
    const token = startToken(env.assessmentStartKey(), "user-1", set.slug, started);
    mocks.userHandler = ownRows(null);
    mocks.adminHandler = () => ({ data: { id: ATTEMPT_ID }, error: null });
    await attempts.POST(ctx(request("POST", { ...body, startToken: token })));
    const insert = mocks.log.find((q) => q.op === "insert");
    expect(insert?.payload).toMatchObject({ server_started_at: new Date(started).toISOString() });
    mocks.log.length = 0;
    mocks.user = { id: "user-2" };
    await attempts.POST(ctx(request("POST", { ...body, startToken: token })));
    const other = mocks.log.find((q) => q.op === "insert");
    expect(other?.payload).toMatchObject({ server_started_at: null });
  });
});
