import { describe, expect, it } from "vitest";
import {
  addDays,
  clearProgress,
  dueDate,
  isDue,
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
