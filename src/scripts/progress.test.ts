import { describe, expect, it } from "vitest";
import {
  activeDays,
  addDays,
  clearProgress,
  dropClearedBefore,
  dueDate,
  foldSets,
  isDue,
  mergeProgress,
  needsReview,
  readProgress,
  record,
  STORAGE_KEY,
} from "./progress.ts";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe("progress", () => {
  it("records a solve", () => {
    const s = memoryStorage();
    expect(record("a", "solved", s).state).toBe("solved");
    expect(readProgress(s)["a"]?.state).toBe("solved");
  });

  it("marks a solve after the answer was shown as solved with help", () => {
    const s = memoryStorage();
    expect(record("a", "revealed", s).state).toBe("revealed");
    expect(record("a", "solved", s).state).toBe("helped");
    expect(record("a", "solved", s).state).toBe("helped");
  });

  it("does not change an earlier clean solve when the answer is opened later", () => {
    const s = memoryStorage();
    record("a", "solved", s);
    expect(record("a", "revealed", s).state).toBe("solved");
  });

  it("survives broken or blocked storage", () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEY, "{not json");
    expect(readProgress(s)).toEqual({});
    const blocked = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error("quota");
      },
      getItem: () => {
        throw new Error("denied");
      },
    } as Storage;
    expect(record("a", "solved", blocked).state).toBe("solved");
    expect(readProgress(undefined)).toEqual({});
  });

  it("brings a solve back for review after growing gaps", () => {
    const s = memoryStorage();
    const first = record("a", "solved", s, "2026-11-10");
    expect(dueDate(first)).toBe("2026-11-11");
    expect(isDue(first, "2026-11-10")).toBe(false);
    expect(isDue(first, "2026-11-11")).toBe(true);
    // Solving again the same day is not a review.
    expect(record("a", "solved", s, "2026-11-10").reviews).toBe(0);
    const second = record("a", "solved", s, "2026-11-11");
    expect(second.reviews).toBe(1);
    expect(dueDate(second)).toBe("2026-11-14");
    let entry = second;
    for (const day of ["2026-11-14", "2026-11-21", "2026-12-12", "2027-02-10"]) {
      entry = record("a", "solved", s, day);
    }
    expect(entry.reviews).toBe(5);
    expect(dueDate(entry)).toBe("2027-04-11");
  });

  it("does not schedule an exercise whose answer was only shown", () => {
    const s = memoryStorage();
    expect(dueDate(record("a", "revealed", s, "2026-11-10"))).toBeNull();
  });

  it("counts days across months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("clears everything", () => {
    const s = memoryStorage();
    record("a", "solved", s);
    clearProgress(s);
    expect(readProgress(s)).toEqual({});
  });
});

describe("misses", () => {
  it("counts wrong checks and keeps them through a solve", () => {
    const s = memoryStorage();
    expect(record("a", "missed", s, "2026-01-01")).toEqual({
      state: "tried",
      date: "2026-01-01",
      misses: 1,
      missed: "2026-01-01",
    });
    record("a", "missed", s, "2026-01-01");
    const solved = record("a", "solved", s, "2026-01-02");
    expect(solved).toMatchObject({ state: "solved", misses: 2, last: "2026-01-02" });
  });

  it("makes a solve after a miss and a shown answer count as with help", () => {
    const s = memoryStorage();
    record("a", "missed", s);
    expect(record("a", "revealed", s).state).toBe("revealed");
    expect(record("a", "solved", s).state).toBe("helped");
  });

  it("never undoes a solve", () => {
    const s = memoryStorage();
    record("a", "solved", s, "2026-01-01");
    expect(record("a", "missed", s, "2026-01-03").state).toBe("solved");
  });

  it("lists missed exercises and due ones for review", () => {
    const s = memoryStorage();
    record("tried", "missed", s, "2026-01-01");
    record("clean", "solved", s, "2026-01-01");
    record("relapse", "solved", s, "2026-01-01");
    record("relapse", "missed", s, "2026-01-01");
    const p = readProgress(s);
    expect(needsReview(p["tried"], "2026-01-01")).toBe(true);
    expect(needsReview(p["clean"], "2026-01-01")).toBe(false);
    expect(needsReview(p["clean"], "2026-01-02")).toBe(true);
    // Missed on the day it was solved: back with the normal review, not at once.
    expect(needsReview(p["relapse"], "2026-01-01")).toBe(false);
    record("relapse", "missed", s, "2026-01-05");
    expect(needsReview(readProgress(s)["relapse"], "2026-01-05")).toBe(true);
    expect(dueDate(p["tried"] ?? { state: "tried", date: "" })).toBeNull();
  });

  it("merges the most misses and the latest miss", () => {
    expect(
      mergeProgress(
        {
          a: {
            state: "solved",
            date: "2026-01-02",
            last: "2026-01-02",
            misses: 1,
            missed: "2026-01-01",
          },
        },
        { a: { state: "tried", date: "2026-01-01", misses: 3, missed: "2026-01-03" } },
      ),
    ).toEqual({
      a: {
        state: "solved",
        date: "2026-01-01",
        last: "2026-01-02",
        misses: 3,
        missed: "2026-01-03",
      },
    });
  });
});

describe("mergeProgress", () => {
  it("keeps entries found in only one place", () => {
    const a = {
      x: { state: "solved" as const, date: "2026-01-01", last: "2026-01-01", reviews: 0 },
    };
    const b = { y: { state: "revealed" as const, date: "2026-02-01" } };
    expect(mergeProgress(a, b)).toEqual({ ...a, ...b });
  });

  it("keeps the furthest state, first day, latest solve and most reviews", () => {
    const a = { x: { state: "revealed" as const, date: "2026-01-05" } };
    const b = {
      x: { state: "helped" as const, date: "2026-01-09", last: "2026-03-01", reviews: 2 },
    };
    expect(mergeProgress(a, b).x).toEqual({
      state: "helped",
      date: "2026-01-05",
      last: "2026-03-01",
      reviews: 2,
    });
    const c = {
      x: { state: "solved" as const, date: "2026-01-02", last: "2026-01-02", reviews: 0 },
    };
    expect(mergeProgress(b, c).x).toEqual({
      state: "solved",
      date: "2026-01-02",
      last: "2026-03-01",
      reviews: 2,
    });
  });

  it("gives the same result in either order", () => {
    const a = {
      x: { state: "solved" as const, date: "2026-01-02", last: "2026-04-01", reviews: 1 },
    };
    const b = {
      x: { state: "helped" as const, date: "2026-01-01", last: "2026-02-01", reviews: 3 },
    };
    expect(mergeProgress(a, b)).toEqual(mergeProgress(b, a));
  });
});

describe("dropClearedBefore", () => {
  it("drops entries last touched before the clear and keeps the day of the clear on", () => {
    const local = {
      old: { state: "solved" as const, date: "2026-11-01", last: "2026-11-10" },
      missedLater: { state: "tried" as const, date: "2026-11-01", missed: "2026-11-19" },
      sameDay: { state: "solved" as const, date: "2026-11-19" },
      after: { state: "helped" as const, date: "2026-11-20" },
    };
    expect(Object.keys(dropClearedBefore(local, "2026-11-19")).sort()).toEqual([
      "after",
      "missedLater",
      "sameDay",
    ]);
  });
});

describe("activeDays", () => {
  it("counts each exercise once per day it touched, plus the extra days", () => {
    const days = activeDays(
      {
        a: { state: "solved", date: "2026-11-10", last: "2026-11-12", reviews: 1 },
        b: { state: "tried", date: "2026-11-12", misses: 2, missed: "2026-11-12" },
        c: { state: "helped", date: "2026-11-11", last: "2026-11-11", missed: "2026-11-10" },
      },
      ["2026-11-12", "2026-11-13"],
    );
    expect(Object.fromEntries(days)).toEqual({
      "2026-11-10": 2,
      "2026-11-11": 1,
      "2026-11-12": 3,
      "2026-11-13": 1,
    });
  });
});

describe("foldSets", () => {
  it("counts a solved ladder step as its exercise solved, a later step as a review", () => {
    const folded = foldSets({
      "sum-a-column": { state: "tried", date: "2026-11-01", misses: 2, missed: "2026-11-01" },
      "sum-a-column-step-2": { state: "solved", date: "2026-11-02", last: "2026-11-02" },
      "sum-a-column-step-4": { state: "helped", date: "2026-11-05", last: "2026-11-05", misses: 1 },
      "sum-drill-1": { state: "solved", date: "2026-11-03", last: "2026-11-03" },
    });
    expect(folded).toEqual({
      "sum-a-column": {
        state: "solved",
        date: "2026-11-01",
        last: "2026-11-05",
        reviews: 1,
        misses: 3,
        missed: "2026-11-01",
      },
      "sum-drill-1": { state: "solved", date: "2026-11-03", last: "2026-11-03" },
    });
  });

  it("leaves a lone step under its exercise id", () => {
    const entry = { state: "solved" as const, date: "2026-11-02", last: "2026-11-02" };
    expect(foldSets({ "sum-a-column-step-5": entry })).toEqual({ "sum-a-column": entry });
  });
});
