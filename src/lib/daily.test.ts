import { describe, expect, it } from "vitest";
import { addDays, localDay } from "../scripts/progress.ts";
import {
  bestStreak,
  cleanDailySolves,
  currentStreak,
  DAILY_START,
  dailyPool,
  isDay,
  LADDER_START,
  ladderPool,
  legacyPickFor,
  mergeDaily,
  mondayOf,
  pickFor,
  stripDays,
  tierOf,
} from "./daily.ts";
import { FIRST_PICKS, LEGACY_POOL } from "./daily-legacy.ts";

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

describe("dailyPool and legacyPickFor, the pick before the ladder", () => {
  it("keeps every exercise, marks the PRO ones and sorts by id", () => {
    expect(pool).toHaveLength(90);
    expect(proIds.size).toBe(72);
    expect(pool.map((e) => e.id)).toEqual([...pool.map((e) => e.id)].sort());
  });

  it("gives the same exercise for the same day, whatever the pool order", () => {
    const reversed = [...pool].reverse();
    for (const day of daysFrom("2026-11-01", 50)) {
      expect(legacyPickFor(day, pool)).toEqual(legacyPickFor(day, reversed));
    }
  });

  it("picks a PRO exercise on Saturdays only, over three years", () => {
    for (const day of daysFrom("2026-11-01", 3 * 366)) {
      const pick = legacyPickFor(day, pool);
      expect(pick).not.toBeNull();
      expect(proIds.has(pick?.id ?? "")).toBe(new Date(`${day}T00:00:00Z`).getUTCDay() === 6);
    }
  });

  it("spreads the days over many exercises", () => {
    const picks = daysFrom("2026-11-01", 365).map((d) => legacyPickFor(d, pool)?.id ?? "");
    expect(new Set(picks.filter((id) => !proIds.has(id))).size).toBe(18);
    expect(new Set(picks.filter((id) => proIds.has(id))).size).toBeGreaterThan(30);
  });

  it("changes few days when one exercise is added", () => {
    const bigger = [...pool, { id: "ex-new", slug: "ex-new", pro: false }];
    const days = daysFrom("2026-11-01", 1000);
    const changed = days.filter((d) => legacyPickFor(d, pool)?.id !== legacyPickFor(d, bigger)?.id);
    // Only the days the new exercise wins can change.
    expect(changed.every((d) => legacyPickFor(d, bigger)?.id === "ex-new")).toBe(true);
    expect(changed.length / days.length).toBeLessThan(0.05);
  });

  it("returns null for an empty pool", () => {
    expect(legacyPickFor("2026-11-15", [])).toBeNull();
  });
});

// 8 tasks for each step of the week, ids out of order on purpose.
const ladder = ladderPool(
  Array.from({ length: 56 }, (_, i) => ({
    id: `d-${String(55 - i).padStart(2, "0")}`,
    slug: `d-${55 - i}`,
    tier: ((55 - i) % 7) + 1,
  })),
);

describe("the weekly ladder", () => {
  it("numbers the days Monday 1 to Sunday 7", () => {
    expect(LADDER_START).toBe("2026-11-16");
    expect(tierOf("2026-11-16")).toBe(1);
    expect(tierOf("2026-11-20")).toBe(5);
    expect(tierOf("2026-11-22")).toBe(7);
    expect(tierOf("2026-11-23")).toBe(1);
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
  });

  it("picks the task for the day's step, the same whatever the pool order", () => {
    for (const day of daysFrom(LADDER_START, 400)) {
      const pick = pickFor(day, ladder);
      expect(pick?.tier).toBe(tierOf(day));
      expect(pickFor(day, ladderPool([...ladder].reverse()))).toEqual(pick);
    }
  });

  it("repeats no task in a step until the step's list is used up", () => {
    for (let t = 0; t < 7; t++) {
      const sameWeekday = Array.from({ length: 16 }, (_, w) => addDays(LADDER_START, t + 7 * w));
      const ids = sameWeekday.map((d) => pickFor(d, ladder)?.id);
      expect(new Set(ids.slice(0, 8)).size).toBe(8);
      expect(ids.slice(8)).toEqual(ids.slice(0, 8));
    }
  });

  it("has no pick before the ladder began or for an empty step", () => {
    expect(pickFor(addDays(LADDER_START, -1), ladder)).toBeNull();
    expect(
      pickFor(
        LADDER_START,
        ladder.filter((e) => e.tier !== 1),
      ),
    ).toBeNull();
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
  const today = "2026-11-20";
  const pools = { ladder, legacy: pool };
  const solve = (day: string) => ({
    day,
    exercise: (day < LADDER_START ? legacyPickFor(day, pool) : pickFor(day, ladder))?.id,
  });

  it("keeps valid solves and drops repeats of a day", () => {
    expect(
      cleanDailySolves([solve(today), solve("2026-11-19"), solve(today)], pools, today),
    ).toEqual([solve(today), solve("2026-11-19")]);
  });

  it("keeps a day solved under the legacy pick, before or after the ladder began", () => {
    expect(cleanDailySolves([solve("2026-11-14")], pools, today)).toEqual([solve("2026-11-14")]);
    const late = { day: "2026-11-17", exercise: legacyPickFor("2026-11-17", pool)?.id };
    expect(cleanDailySolves([late], pools, today)).toEqual([late]);
  });

  it("keeps solves saved under every deployed build's legacy pick, whatever the content now", () => {
    const frozen = { ladder, legacy: LEGACY_POOL };
    // 777eddd onward: the frozen pool gives the picks that build gave.
    for (const [day, exercise] of [
      ["2026-11-12", "average-score"],
      ["2026-11-16", "count-booked-seats"],
      ["2026-11-21", "share-handed-in"],
    ] as const) {
      expect(legacyPickFor(day, LEGACY_POOL)?.id).toBe(exercise);
      expect(cleanDailySolves([{ day, exercise }], frozen, today)).toEqual([{ day, exercise }]);
    }
    // 02c646c, the first build, picked from free exercises only.
    const first = { day: "2026-11-16", exercise: "aggregate-functions-summary" };
    expect(FIRST_PICKS[first.day]).toBe(first.exercise);
    expect(cleanDailySolves([first], frozen, today)).toEqual([first]);
    expect(
      cleanDailySolves([{ day: "2026-11-16", exercise: "find-a-code" }], frozen, today),
    ).toBeNull();
  });

  it("accepts tomorrow in UTC, for time zones ahead of it", () => {
    expect(cleanDailySolves([solve("2026-11-21")], pools, today)).not.toBeNull();
  });

  it("rejects days after tomorrow, before the start, or not real", () => {
    expect(cleanDailySolves([solve("2026-11-22")], pools, today)).toBeNull();
    expect(
      cleanDailySolves([{ day: addDays(DAILY_START, -1), exercise: "ex-00" }], pools, today),
    ).toBeNull();
    expect(cleanDailySolves([{ day: "2026-02-30", exercise: "ex-00" }], pools, today)).toBeNull();
  });

  it("rejects an exercise that is not the day's pick", () => {
    const wrong = ladder.find((e) => e.id !== pickFor(today, ladder)?.id)?.id;
    expect(cleanDailySolves([{ day: today, exercise: wrong }], pools, today)).toBeNull();
  });

  it("rejects bodies that are not a short list", () => {
    expect(cleanDailySolves(null, pools, today)).toBeNull();
    expect(cleanDailySolves({ day: today }, pools, today)).toBeNull();
    expect(cleanDailySolves([], pools, today)).toBeNull();
    expect(cleanDailySolves(Array(401).fill(solve(today)), pools, today)).toBeNull();
  });

  it("keeps the good days in a mixed batch and drops the bad ones", () => {
    const good = solve("2026-11-19");
    const stale = { day: "2026-11-18", exercise: "no-longer-in-the-pool" };
    const future = solve("2026-11-25");
    expect(cleanDailySolves([stale, good, future, "x"], pools, today)).toEqual([good]);
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
