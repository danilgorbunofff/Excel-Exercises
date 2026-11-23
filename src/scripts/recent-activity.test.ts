import { describe, expect, it } from "vitest";
import { dayLabel, recentActivity } from "./recent-activity.ts";

const exercises = new Map([
  ["a", { title: "Add two cells", href: "/exercises/a/", trackTitle: "Cells and arithmetic" }],
  ["b", { title: "Average score", href: "/exercises/b/", trackTitle: "SUM, AVERAGE, MIN and MAX" }],
  ["c", { title: "Pass or fail", href: "/exercises/c/", trackTitle: "IF, AND and OR" }],
]);

describe("recentActivity", () => {
  it("merges exercises, dailies and attempts, newest first", () => {
    const rows = recentActivity({
      progress: {
        a: { state: "solved", date: "2026-11-18", last: "2026-11-18" },
        b: { state: "helped", date: "2026-11-21", last: "2026-11-21" },
        c: { state: "tried", date: "2026-11-20", misses: 1, missed: "2026-11-22" },
        gone: { state: "solved", date: "2026-11-22", last: "2026-11-22" },
      },
      exercises,
      daily: { "2026-11-22": "d1" },
      dailyTitles: { d1: "Best quarter for a product" },
      attempts: [
        { assessment: "finance", finished_at: "2026-11-21T10:00:00", score: 9, total: 10 },
      ],
      setTitles: { finance: "Finance" },
    });
    expect(rows.map((r) => [r.title, r.result, r.day])).toEqual([
      ["Pass or fail", "Wrong answer", "2026-11-22"],
      ["Best quarter for a product", "Solved", "2026-11-22"],
      ["Finance", "9 of 10, 90%", "2026-11-21"],
      ["Average score", "Solved with a hint", "2026-11-21"],
      ["Add two cells", "Solved", "2026-11-18"],
    ]);
    expect(rows[2]?.good).toBe(true);
    expect(rows[0]?.good).toBe(false);
  });

  it("keeps only the limit", () => {
    const daily = Object.fromEntries(
      ["2026-11-01", "2026-11-02", "2026-11-03"].map((d) => [d, "x"]),
    );
    const rows = recentActivity(
      { progress: {}, exercises, daily, dailyTitles: {}, attempts: [], setTitles: {} },
      2,
    );
    expect(rows.map((r) => r.day)).toEqual(["2026-11-03", "2026-11-02"]);
    expect(rows[0]?.title).toBe("Daily exercise");
  });
});

describe("dayLabel", () => {
  it("says today, yesterday or the date", () => {
    expect(dayLabel("2026-11-22", "2026-11-22")).toBe("Today");
    expect(dayLabel("2026-11-21", "2026-11-22")).toBe("Yesterday");
    expect(dayLabel("2026-11-02", "2026-11-22")).toBe("2 Nov");
  });
});
