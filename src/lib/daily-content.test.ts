// The weekly ladder with the real daily tasks in content/daily/: every step of
// the week has tasks, each day's pick is that weekday's step across years and
// leap days, and no task repeats inside its step's cycle.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { addDays, localDay } from "../scripts/progress.ts";
import { LADDER_START, ladderPool, pickFor, tierOf } from "./daily.ts";

const tasks = readdirSync("content/daily")
  .filter((f) => f.endsWith(".yaml"))
  .map(
    (f) =>
      parse(readFileSync(`content/daily/${f}`, "utf8")) as {
        id: string;
        slug: string;
        tier: number;
      },
  );
const pool = ladderPool(tasks);
const isoWeekday = (day: string) => ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

describe("the ladder with the real daily tasks", () => {
  it("has tasks for every step of the week", () => {
    for (let tier = 1; tier <= 7; tier++)
      expect(pool.filter((e) => e.tier === tier).length, `tier ${tier}`).toBeGreaterThan(0);
  });

  it("picks the weekday's step every day for three years, leap day and year ends included", () => {
    const days = Array.from({ length: 3 * 366 }, (_, i) => addDays(LADDER_START, i));
    expect(days).toContain("2028-02-29");
    for (const day of days) {
      const pick = pickFor(day, pool);
      expect(tierOf(day)).toBe(isoWeekday(day));
      expect(pick?.tier, day).toBe(isoWeekday(day));
    }
    expect(pickFor("2028-02-29", pool)?.tier).toBe(2);
    expect(pickFor("2026-12-31", pool)?.tier).toBe(4);
    expect(pickFor("2027-01-03", pool)?.tier).toBe(7);
  });

  it("repeats no task inside a step's cycle", () => {
    for (let tier = 1; tier <= 7; tier++) {
      const size = pool.filter((e) => e.tier === tier).length;
      const ids = Array.from(
        { length: size },
        (_, w) => pickFor(addDays(LADDER_START, tier - 1 + 7 * w), pool)?.id,
      );
      expect(new Set(ids).size, `tier ${tier}`).toBe(size);
    }
  });

  it("follows the local date across a southern clock change and far east zones", () => {
    const saved = process.env["TZ"];
    try {
      process.env["TZ"] = "Australia/Sydney";
      // Clocks go back on 5 April 2026 and forward on 4 October 2026.
      expect(pickFor(localDay(new Date(2026, 3, 5, 2, 30)), pool)).toBeNull();
      const sunday = localDay(new Date(2026, 9, 4, 2, 30));
      expect(sunday).toBe("2026-10-04");
      expect(pickFor(localDay(new Date(2026, 10, 22, 23, 59)), pool)?.tier).toBe(7);
      expect(pickFor(localDay(new Date(2026, 10, 23, 0, 0)), pool)?.tier).toBe(1);
      process.env["TZ"] = "Pacific/Auckland";
      expect(pickFor(localDay(new Date(2026, 10, 16, 0, 1)), pool)?.tier).toBe(1);
      process.env["TZ"] = "Asia/Kolkata";
      expect(pickFor(localDay(new Date(2026, 10, 21, 23, 59)), pool)?.tier).toBe(6);
    } finally {
      if (saved === undefined) delete process.env["TZ"];
      else process.env["TZ"] = saved;
    }
  });
});
