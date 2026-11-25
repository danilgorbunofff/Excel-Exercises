import { describe, expect, it } from "vitest";
import { profileStats } from "./profile-stats.ts";

const item = (id: string, level: number, track: string) => ({
  id,
  title: id,
  href: `/exercises/${id}/`,
  level,
  track,
});
const items = [item("a", 1, "t1"), item("b", 1, "t1"), item("c", 2, "t2"), item("d", 3, "t2")];

describe("profileStats", () => {
  it("counts nothing for a new learner and points at the first exercise", () => {
    const s = profileStats(items, {}, [], "2026-11-22");
    expect(s).toMatchObject({ solved: 0, helped: 0, due: 0, percent: 0, days: 0, last: null });
    expect(s.next?.id).toBe("a");
    expect(s.levels.get(1)).toEqual({ solved: 0, total: 2 });
  });

  it("counts solves per level and track, due reviews and practice days", () => {
    const s = profileStats(
      items,
      {
        a: { state: "solved", date: "2026-11-10", last: "2026-11-10" },
        b: { state: "helped", date: "2026-11-21", last: "2026-11-21" },
        c: { state: "tried", date: "2026-11-21", misses: 1, missed: "2026-11-21" },
      },
      ["2026-11-22"],
      "2026-11-22",
    );
    expect(s).toMatchObject({ solved: 2, helped: 1, percent: 50, days: 3, last: "2026-11-22" });
    // a and b are due again (first gap is one day), c was missed and never solved.
    expect(s.due).toBe(3);
    expect(s.next?.id).toBe("c");
    expect(s.levels.get(1)).toEqual({ solved: 2, total: 2 });
    expect(s.tracks.get("t2")).toEqual({ solved: 0, total: 2 });
  });

  it("counts an exercise once however many of its ladder steps are solved", () => {
    const s = profileStats(
      items,
      {
        "a-step-2": { state: "solved", date: "2026-11-10", last: "2026-11-10" },
        "a-step-5": { state: "solved", date: "2026-11-12", last: "2026-11-12" },
        a: { state: "solved", date: "2026-11-11", last: "2026-11-11" },
        "c-step-4": { state: "solved", date: "2026-11-20", last: "2026-11-20" },
      },
      [],
      "2026-11-22",
    );
    expect(s.solved).toBe(2);
    expect(s.levels.get(1)).toEqual({ solved: 1, total: 2 });
    expect(s.tracks.get("t2")).toEqual({ solved: 1, total: 2 });
  });

  it("has no next exercise once all are solved", () => {
    const all = Object.fromEntries(
      items.map((i) => [
        i.id,
        { state: "solved" as const, date: "2026-11-22", last: "2026-11-22" },
      ]),
    );
    const s = profileStats(items, all, [], "2026-11-22");
    expect(s.next).toBeNull();
    expect(s.percent).toBe(100);
  });
});
