import { describe, expect, it } from "vitest";
import { weeklyDigest } from "./digest.ts";
import { readUnsubscribeToken, unsubscribeToken } from "./email.ts";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("unsubscribe token", () => {
  it("reads back the user it was signed for, with the same key only", () => {
    const token = unsubscribeToken("key", ID);
    expect(readUnsubscribeToken("key", token)).toBe(ID);
    expect(readUnsubscribeToken("other", token)).toBeNull();
    expect(readUnsubscribeToken("key", token.replace(/.$/u, "x"))).toBeNull();
    expect(
      readUnsubscribeToken("key", `${ID.replace("0", "1")}.${token.split(".")[1]}`),
    ).toBeNull();
    for (const bad of [null, "", "abc", `${ID}`, `${ID}.`])
      expect(readUnsubscribeToken("key", bad)).toBeNull();
  });
});

describe("weeklyDigest", () => {
  const links = { progress: "https://x.test/progress/", unsubscribe: "https://x.test/u" };

  it("says nothing when there is nothing to say", () => {
    expect(weeklyDigest({}, "2026-11-23", links)).toBeNull();
    expect(
      weeklyDigest(
        { a: { state: "solved", date: "2026-11-01", last: "2026-11-20", reviews: 4 } },
        "2026-11-23",
        links,
      )?.text,
    ).toContain("This week you solved 1 exercise.");
  });

  it("counts solves this week, reviews due and tries not yet solved", () => {
    const d = weeklyDigest(
      {
        a: { state: "solved", date: "2026-11-20", last: "2026-11-20", reviews: 0 },
        b: { state: "helped", date: "2026-10-01", last: "2026-10-01", reviews: 1 },
        c: { state: "tried", date: "2026-11-18", misses: 2, missed: "2026-11-18" },
      },
      "2026-11-23",
      links,
    );
    expect(d?.subject).toBe("3 exercises to review this week");
    expect(d?.text).toContain("This week you solved 1 exercise.");
    expect(d?.text).toContain("2 exercises you solved before are due for review.");
    expect(d?.text).toContain("1 exercise you tried is not solved yet.");
    expect(d?.text).toContain("Stop it: https://x.test/u");
  });
});
