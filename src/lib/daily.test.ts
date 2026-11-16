import { describe, expect, it } from "vitest";
import { addDays, localDay } from "../scripts/progress.ts";
import {
  bestStreak,
  cleanDailySolves,
  currentStreak,
  DAILY_START,
  dailyPool,
  isDay,
  isProDay,
  mergeDaily,
  pickFor,
  stripDays,
} from "./daily.ts";

// 9 tracks of 10: the first 2 of each are free, so 18 free and 72 PRO.
const placed = Array.from({ length: 90 }, (_, i) => ({
  exercise: { id: `ex-${String(i).padStart(2, "0")}`, slug: `ex-${i}` },
  topicNumber: (i % 10) + 1,
}));
const pool = dailyPool(placed);
const proIds = new Set(pool.filter((e) => e.pro).map((e) => e.id));
const daysFrom = (start: string, n: number) =>
  Array.from({ length: n }, (_, i) => addDays(start, i));
const set = (...days: string[]) => new Set(days);

describe("dailyPool and pickFor", () => {
  it("keeps every exercise, marks the PRO ones and sorts by id", () => {
    expect(pool).toHaveLength(90);
    expect(proIds.size).toBe(72);
    expect(pool.map((e) => e.id)).toEqual([...pool.map((e) => e.id)].sort());
  });

  it("gives the same exercise for the same day, whatever the pool order", () => {
    const reversed = [...pool].reverse();
    for (const day of daysFrom("2026-11-01", 50)) {
      expect(pickFor(day, pool)).toEqual(pickFor(day, reversed));
    }
  });

  it("picks a PRO exercise on Saturdays only, over three years", () => {
    for (const day of daysFrom("2026-11-01", 3 * 366)) {
      const pick = pickFor(day, pool);
      expect(pick).not.toBeNull();
      expect(proIds.has(pick?.id ?? "")).toBe(isProDay(day));
    }
  });

  it("knows Saturday from the date alone", () => {
    expect(isProDay("2026-11-21")).toBe(true);
    expect(isProDay("2026-11-20")).toBe(false);
    expect(isProDay("2026-11-22")).toBe(false);
  });

  it("spreads the days over many exercises", () => {
    const picks = daysFrom("2026-11-01", 365).map((d) => pickFor(d, pool)?.id ?? "");
    expect(new Set(picks.filter((id) => !proIds.has(id))).size).toBe(18);
    expect(new Set(picks.filter((id) => proIds.has(id))).size).toBeGreaterThan(30);
  });

  it("changes few days when one exercise is added", () => {
    const bigger = [...pool, { id: "ex-new", slug: "ex-new", pro: false }];
    const days = daysFrom("2026-11-01", 1000);
    const changed = days.filter((d) => pickFor(d, pool)?.id !== pickFor(d, bigger)?.id);
    // Only the days the new exercise wins can change.
    expect(changed.every((d) => pickFor(d, bigger)?.id === "ex-new")).toBe(true);
    expect(changed.length / days.length).toBeLessThan(0.05);
  });

  it("returns null for an empty pool", () => {
    expect(pickFor("2026-11-15", [])).toBeNull();
  });
});

describe("streaks", () => {
  it("is zero with no solves", () => {
    expect(currentStreak(set(), "2026-11-15")).toBe(0);
    expect(bestStreak(set())).toBe(0);
  });

  it("counts today and the days before it", () => {
    expect(currentStreak(set("2026-11-13", "2026-11-14", "2026-11-15"), "2026-11-15")).toBe(3);
  });

  it("keeps yesterday's run while today is not solved yet", () => {
    expect(currentStreak(set("2026-11-13", "2026-11-14"), "2026-11-15")).toBe(2);
  });

  it("resets after a missed day", () => {
    expect(currentStreak(set("2026-11-12", "2026-11-13"), "2026-11-15")).toBe(0);
    expect(currentStreak(set("2026-11-12", "2026-11-13", "2026-11-15"), "2026-11-15")).toBe(1);
  });

  it("finds the longest run across gaps", () => {
    const days = set("2026-11-01", "2026-11-02", "2026-11-03", "2026-11-05", "2026-11-06");
    expect(bestStreak(days)).toBe(3);
    expect(currentStreak(days, "2026-11-06")).toBe(2);
  });

  it("runs across month, year and leap day edges", () => {
    expect(currentStreak(set("2026-11-30", "2026-12-01"), "2026-12-01")).toBe(2);
    expect(currentStreak(set("2026-12-31", "2027-01-01"), "2027-01-02")).toBe(2);
    expect(bestStreak(set("2028-02-28", "2028-02-29", "2028-03-01"))).toBe(3);
    expect(bestStreak(set("2027-02-28", "2027-03-01"))).toBe(2);
  });
});

describe("stripDays", () => {
  it("lists the last days oldest first, ending today", () => {
    const strip = stripDays(set("2026-11-14"), "2026-11-15", 3);
    expect(strip).toEqual([
      { day: "2026-11-13", solved: false, today: false },
      { day: "2026-11-14", solved: true, today: false },
      { day: "2026-11-15", solved: false, today: true },
    ]);
    expect(stripDays(set(), "2027-01-02")[0]?.day).toBe("2026-12-20");
  });
});

describe("isDay", () => {
  it("accepts real days only", () => {
    expect(isDay("2028-02-29")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-11-5")).toBe(false);
    expect(isDay(20261115)).toBe(false);
  });
});

describe("cleanDailySolves", () => {
  const today = "2026-11-15";
  const solve = (day: string) => ({ day, exercise: pickFor(day, pool)?.id });

  it("keeps valid solves and drops repeats of a day", () => {
    expect(
      cleanDailySolves([solve(today), solve("2026-11-14"), solve(today)], pool, today),
    ).toEqual([solve(today), solve("2026-11-14")]);
  });

  it("accepts tomorrow in UTC, for time zones ahead of it", () => {
    expect(cleanDailySolves([solve("2026-11-16")], pool, today)).not.toBeNull();
  });

  it("rejects days after tomorrow, before the start, or not real", () => {
    expect(cleanDailySolves([solve("2026-11-17")], pool, today)).toBeNull();
    expect(cleanDailySolves([solve(addDays(DAILY_START, -1))], pool, today)).toBeNull();
    expect(cleanDailySolves([{ day: "2026-02-30", exercise: "ex-00" }], pool, today)).toBeNull();
  });

  it("rejects an exercise that is not the day's pick", () => {
    const wrong = pool.find((e) => e.id !== pickFor(today, pool)?.id)?.id;
    expect(cleanDailySolves([{ day: today, exercise: wrong }], pool, today)).toBeNull();
  });

  it("rejects bodies that are not a short list", () => {
    expect(cleanDailySolves(null, pool, today)).toBeNull();
    expect(cleanDailySolves({ day: today }, pool, today)).toBeNull();
    expect(cleanDailySolves([], pool, today)).toBeNull();
    expect(cleanDailySolves(Array(401).fill(solve(today)), pool, today)).toBeNull();
  });
});

describe("cleanDailySolves with a mixed batch", () => {
  it("keeps the good days and drops the bad ones", () => {
    const today = "2026-11-15";
    const good = { day: "2026-11-14", exercise: pickFor("2026-11-14", pool)?.id };
    const stale = { day: "2026-11-13", exercise: "no-longer-in-the-pool" };
    const future = { day: "2026-11-20", exercise: pickFor("2026-11-20", pool)?.id };
    expect(cleanDailySolves([stale, good, future, "x"], pool, today)).toEqual([good]);
  });
});

describe("mergeDaily", () => {
  it("joins both sides and lists the browser's days the account lacks", () => {
    const { days, missing } = mergeDaily({ "2026-11-13": "a", "2026-11-14": "b" }, [
      { day: "2026-11-14", exercise: "b" },
      { day: "2026-11-15", exercise: "c" },
    ]);
    expect(days).toEqual({ "2026-11-13": "a", "2026-11-14": "b", "2026-11-15": "c" });
    expect(missing).toEqual([{ day: "2026-11-13", exercise: "a" }]);
  });

  it("keeps the account's exercise when both have the day", () => {
    expect(
      mergeDaily({ "2026-11-14": "local" }, [{ day: "2026-11-14", exercise: "server" }]),
    ).toEqual({
      days: { "2026-11-14": "server" },
      missing: [],
    });
  });

  it("never sends days before the start or that are not real days", () => {
    const { days, missing } = mergeDaily(
      { [addDays(DAILY_START, -1)]: "a", "2026-02-30": "b", "2026-11-20": "c" },
      [],
    );
    expect(Object.keys(days)).toHaveLength(3);
    expect(missing).toEqual([{ day: "2026-11-20", exercise: "c" }]);
  });

  it("is a no-op on two empty sides", () => {
    expect(mergeDaily({}, [])).toEqual({ days: {}, missing: [] });
  });
});

describe("local dates around midnight and clock changes", () => {
  const savedTz = process.env["TZ"];
  const inZone = (tz: string, fn: () => void) => {
    process.env["TZ"] = tz;
    try {
      fn();
    } finally {
      if (savedTz === undefined) delete process.env["TZ"];
      else process.env["TZ"] = savedTz;
    }
  };
  /** The local day of a wall-clock time in the current zone. */
  const at = (y: number, m: number, d: number, h: number, min = 0, s = 0) =>
    localDay(new Date(y, m - 1, d, h, min, s));

  it("splits days at local midnight", () => {
    inZone("Europe/London", () => {
      expect(at(2026, 11, 15, 23, 59, 59)).toBe("2026-11-15");
      expect(at(2026, 11, 16, 0, 0, 0)).toBe("2026-11-16");
    });
    inZone("Pacific/Kiritimati", () => {
      expect(at(2026, 12, 31, 23, 59, 59)).toBe("2026-12-31");
      expect(at(2027, 1, 1, 0, 0, 0)).toBe("2027-01-01");
    });
  });

  it("keeps a streak across the European spring and autumn changes", () => {
    inZone("Europe/London", () => {
      // 29 March 2026 has 23 hours, 25 October 2026 has 25.
      const spring = [at(2026, 3, 28, 23, 30), at(2026, 3, 29, 0, 30), at(2026, 3, 30, 0, 30)];
      expect(currentStreak(new Set(spring), at(2026, 3, 30, 23))).toBe(3);
      const autumn = [at(2026, 10, 24, 23, 30), at(2026, 10, 25, 1, 30), at(2026, 10, 26, 0, 5)];
      expect(currentStreak(new Set(autumn), at(2026, 10, 26, 12))).toBe(3);
    });
  });

  it("keeps a streak across the American changes", () => {
    inZone("America/New_York", () => {
      const spring = [at(2026, 3, 7, 22), at(2026, 3, 8, 3, 30), at(2026, 3, 9, 0, 1)];
      expect(currentStreak(new Set(spring), at(2026, 3, 9, 8))).toBe(3);
      const autumn = [at(2026, 10, 31, 23, 59), at(2026, 11, 1, 1, 30), at(2026, 11, 2, 0, 0)];
      expect(new Set(autumn).size).toBe(3);
      expect(currentStreak(new Set(autumn), at(2026, 11, 2, 23, 59))).toBe(3);
      expect(bestStreak(new Set(autumn))).toBe(3);
    });
  });
});
