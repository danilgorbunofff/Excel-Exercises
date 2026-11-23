// The cron jobs run only for Vercel's cron call, which carries the secret. The
// daily job mails each person one email a day (welcome first, then the starter
// series or that day's ladder task): the mail_log row is written first, so a
// second run the same day mails nobody again.
import type { APIContext, APIRoute } from "astro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeClient, type Handler, type Query } from "./fake-supabase.ts";

const mocks = vi.hoisted(() => ({
  db: null as unknown,
  sent: [] as { to: string; subject: string; text: string; html?: string; unsubscribe: string }[],
}));

vi.mock("./supabase.ts", () => ({
  adminClient: () => {
    if (!mocks.db) throw new Error("must not reach the database");
    return mocks.db;
  },
}));
vi.mock("./email.ts", async (load) => ({
  ...(await load<typeof import("./email.ts")>()),
  sendMail: async (mail: (typeof mocks.sent)[number]) => {
    mocks.sent.push(mail);
    return true;
  },
}));
vi.mock("./assessment-specs.ts", () => ({ loadSkills: async () => () => ["SUM"] }));
// 2026-11-23 is a Monday, step 1 of the ladder.
vi.mock("../lib/exercises.ts", () => ({
  dailyTasks: async () => [
    {
      tier: 1,
      exercise: {
        id: "monday-task",
        slug: "monday-task",
        level: 1,
        title: "Monday task",
        screens: [
          { prompt: "In B3, add the numbers.", rows: [["N"], [1], [null]], answerCell: "A3" },
        ],
      },
    },
  ],
}));

const weekly = (await import("../pages/api/cron/weekly.ts")).GET;
const daily = (await import("../pages/api/cron/daily.ts")).GET;

const call = (route: APIRoute, auth?: string) =>
  route({
    request: new Request("http://x.test/api/cron/", {
      headers: auth ? { authorization: auth } : {},
    }),
    url: new URL("http://x.test/api/cron/"),
  } as unknown as APIContext);

beforeEach(() => {
  process.env["CRON_SECRET"] = "s3cret";
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service";
  mocks.db = null;
  mocks.sent.length = 0;
});
afterEach(() => vi.useRealTimers());

describe("cron jobs", () => {
  it("refuse a call without the cron secret", async () => {
    for (const route of [weekly, daily]) {
      expect((await call(route)).status).toBe(401);
      expect((await call(route, "Bearer wrong")).status).toBe(401);
    }
  });
});

describe("GET /api/cron/daily", () => {
  const people = [
    { id: "u1", pro_status: null, pro_until: null },
    { id: "u2", pro_status: null, pro_until: null },
    { id: "u3", pro_status: null, pro_until: null },
  ];
  const emails: Record<string, string | undefined> = { u1: "a@x.test", u2: "b@x.test" };

  /** `welcomed` maps a user id to the day their welcome email went out. */
  const run = async (
    logged: Set<string>,
    welcomed: Record<string, string> = {},
    who = people,
    rows: Record<string, unknown> = {},
  ) => {
    const log: Query[] = [];
    const handler: Handler = (q) => {
      if (q.table === "profiles") return { data: who, error: null };
      if (q.table !== "mail_log") return { data: rows[q.table] ?? null, error: null };
      if (q.op === "select") {
        const day = welcomed[q.filters["user_id"] as string];
        return { data: day ? { sent_at: `${day}T12:00:01Z` } : null, error: null };
      }
      const row = q.payload as { user_id: string; kind: string };
      const key = `${row.user_id}|${row.kind}`;
      if (logged.has(key)) return { data: null, error: { code: "23505" } };
      logged.add(key);
      return { data: null, error: null };
    };
    mocks.db = {
      ...fakeClient(handler, log),
      auth: {
        admin: {
          getUserById: async (id: string) => ({
            data: { user: emails[id] ? { email: emails[id] } : null },
          }),
        },
      },
    };
    const res = await call(daily, "Bearer s3cret");
    return { res, body: (await res.json()) as Record<string, unknown>, log };
  };
  const inserts = (log: Query[]) =>
    log.filter((q) => q.table === "mail_log" && q.op === "insert").map((q) => q.payload);

  it("welcomes each opted-in person once, logging before sending", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-23T12:00:00Z") });
    const logged = new Set<string>();
    const first = await run(logged);
    expect(first.body).toEqual({ day: "2026-11-23", people: 3, sent: 2 });
    expect(first.log[0]).toMatchObject({ table: "profiles", filters: { daily: true } });
    expect(inserts(first.log)).toEqual([
      { user_id: "u1", kind: "daily:2026-11-23" },
      { user_id: "u1", kind: "welcome" },
      { user_id: "u2", kind: "daily:2026-11-23" },
      { user_id: "u2", kind: "welcome" },
      { user_id: "u3", kind: "daily:2026-11-23" },
    ]);
    expect(mocks.sent.map((m) => m.to)).toEqual(["a@x.test", "b@x.test"]);
    const [mail] = mocks.sent;
    expect(mail?.subject).toBe("Welcome to Excel Exercises");
    expect(mail?.html).toContain("Monday task");
    expect(mail?.text).toContain(
      "Check your level (10 minutes): http://x.test/mock-assessments/sample/",
    );
    expect(mail?.unsubscribe).toMatch(/^http:\/\/x\.test\/api\/email\/unsubscribe\/\?t=u1\./u);

    mocks.sent.length = 0;
    const again = await run(logged);
    expect(again.body).toEqual({ day: "2026-11-23", people: 3, sent: 0 });
    expect(mocks.sent).toEqual([]);
  });

  it("sends the daily exercise between starter emails, and the series on its day", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-30T12:00:00Z") });
    await run(new Set(), { u1: "2026-11-29", u2: "2026-11-28" });
    expect(mocks.sent.map((m) => m.subject)).toEqual([
      "Today: Monday task",
      "How good is your Excel?",
    ]);
  });

  it("scores the sample result per skill on the level day", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-30T12:00:00Z") });
    const attempt = { score: 1, total: 2, results: [{ correct: true }, { correct: false }] };
    await run(new Set(), { u1: "2026-11-28" }, people.slice(0, 1), {
      assessment_attempts: attempt,
    });
    expect(mocks.sent[0]?.subject).toBe("Your Excel score: 50%");
    expect(mocks.sent[0]?.text).toContain("SUM: 50%");
  });

  it("counts solves and the streak in the week email, and sends PRO members none", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-30T12:00:00Z") });
    const who = [people[0], { id: "u2", pro_status: "lifetime", pro_until: null }];
    await run(new Set(), { u1: "2026-11-23", u2: "2026-11-23" }, who as typeof people, {
      progress: [{ entry: { state: "solved" } }, { entry: { state: "tried" } }],
      daily_solves: [{ day: "2026-11-29" }, { day: "2026-11-30" }],
    });
    expect(mocks.sent.map((m) => m.subject)).toEqual([
      "Week one: 1 exercise solved",
      "Today: Monday task",
    ]);
    expect(mocks.sent[0]?.text).toContain("2-day streak");
  });

  it("mails nothing on a day with no task", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-24T12:00:00Z") });
    const { body, log } = await run(new Set());
    expect(body).toEqual({ day: "2026-11-24", people: 0, sent: 0 });
    expect(log).toEqual([]);
  });
});
