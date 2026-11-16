import { describe, expect, it } from "vitest";
import { assessmentsSchema } from "../content/schema.ts";
import { newCertificateId, readStartToken, startToken } from "../server/start-token.ts";
import {
  CERTIFICATE_ID,
  checkIssue,
  cleanName,
  GRACE_S,
  passes,
  type StoredAttempt,
} from "./certificates.ts";

const [set, sample] = assessmentsSchema.parse({
  sets: [
    { slug: "office", title: "Office", summary: "O.", minutes: 30, tasks: ["a", "b"] },
    { slug: "sample", title: "Sample", summary: "S.", minutes: 10, sample: true, tasks: ["a"] },
  ],
}).sets;

const start = "2026-11-15T10:00:00.000Z";
const attempt: StoredAttempt = {
  assessment: "office",
  score: 9,
  total: 10,
  time_limit_s: 1800,
  server_started_at: start,
  received_at: "2026-11-15T10:25:00.000Z",
};
const ok = { set, attempt, regraded: { score: 9, total: 10 }, pro: true };

describe("passes", () => {
  it("is 80% or more, exactly at the edge", () => {
    expect(passes(8, 10)).toBe(true);
    expect(passes(7, 10)).toBe(false);
    expect(passes(4, 5)).toBe(true);
    expect(passes(3, 5)).toBe(false);
    expect(passes(24, 30)).toBe(true);
    expect(passes(23, 30)).toBe(false);
    expect(passes(0, 0)).toBe(false);
  });
});

describe("checkIssue", () => {
  it("issues for a passed, timed, server-started PRO run whose re-grade matches", () => {
    expect(checkIssue(ok)).toEqual({ ok: true });
  });

  it("refuses when the re-grade does not match the stored score", () => {
    expect(checkIssue({ ...ok, regraded: { score: 8, total: 10 } })).toMatchObject({
      ok: false,
      status: 409,
      error: "re-grade mismatch",
    });
    expect(checkIssue({ ...ok, regraded: null })).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses below the pass mark even when the re-grade matches", () => {
    const low = { ...attempt, score: 7 };
    expect(checkIssue({ ...ok, attempt: low, regraded: { score: 7, total: 10 } })).toMatchObject({
      ok: false,
      error: "below the pass mark",
    });
  });

  it("refuses the sample, an unknown set and a visitor without PRO", () => {
    expect(checkIssue({ ...ok, set: sample })).toMatchObject({ ok: false, status: 403 });
    expect(checkIssue({ ...ok, set: undefined })).toMatchObject({ ok: false, status: 400 });
    expect(checkIssue({ ...ok, pro: false })).toMatchObject({ ok: false, error: "PRO needed" });
  });

  it("refuses untimed runs and runs whose start the server did not stamp", () => {
    expect(checkIssue({ ...ok, attempt: { ...attempt, time_limit_s: null } })).toMatchObject({
      ok: false,
      error: "only timed runs earn a certificate",
    });
    expect(checkIssue({ ...ok, attempt: { ...attempt, server_started_at: null } })).toMatchObject({
      ok: false,
    });
  });

  it("allows the grace past the limit, and refuses one second more", () => {
    const at = (s: number) => new Date(Date.parse(start) + s * 1000).toISOString();
    const limit = 1800 + GRACE_S;
    expect(checkIssue({ ...ok, attempt: { ...attempt, received_at: at(limit) } })).toEqual({
      ok: true,
    });
    expect(
      checkIssue({ ...ok, attempt: { ...attempt, received_at: at(limit + 1) } }),
    ).toMatchObject({
      ok: false,
      error: "the run went over time",
    });
    expect(checkIssue({ ...ok, attempt: { ...attempt, received_at: at(-1) } })).toMatchObject({
      ok: false,
    });
  });
});

describe("cleanName", () => {
  it("tidies spaces and keeps letters from any script", () => {
    expect(cleanName("  Ada   Lovelace ")).toBe("Ada Lovelace");
    expect(cleanName("Zoë O'Neil-Smith")).toBe("Zoë O'Neil-Smith");
    expect(cleanName("Дарья Петрова")).toBe("Дарья Петрова");
  });

  it("refuses empty, too long, markup and other characters", () => {
    expect(cleanName("")).toBeNull();
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("a".repeat(81))).toBeNull();
    expect(cleanName("<b>Ada</b>")).toBeNull();
    expect(cleanName("Ada https://x.y")).toBeNull();
    expect(cleanName("-Ada")).toBeNull();
    expect(cleanName(42)).toBeNull();
  });
});

describe("start token and certificate id", () => {
  const key = "k";
  const now = Date.UTC(2026, 10, 15, 10);

  it("reads back the start for the same user and set only", () => {
    const token = startToken(key, "user-1", "office", now);
    expect(readStartToken(key, "user-1", "office", token, now + 1000)).toBe(now);
    expect(readStartToken(key, "user-2", "office", token, now + 1000)).toBeNull();
    expect(readStartToken(key, "user-1", "finance", token, now + 1000)).toBeNull();
    expect(readStartToken("other", "user-1", "office", token, now + 1000)).toBeNull();
  });

  it("refuses a changed time, a start in the future and junk", () => {
    const token = startToken(key, "user-1", "office", now);
    const [, sig] = token.split(".");
    expect(readStartToken(key, "user-1", "office", `${now - 60_000}.${sig}`, now)).toBeNull();
    expect(readStartToken(key, "user-1", "office", token, now - 1)).toBeNull();
    expect(readStartToken(key, "user-1", "office", null, now)).toBeNull();
    expect(readStartToken(key, "user-1", "office", "x.y", now)).toBeNull();
  });

  it("makes random 22-character ids", () => {
    const a = newCertificateId();
    expect(a).toMatch(CERTIFICATE_ID);
    expect(newCertificateId()).not.toBe(a);
  });
});
