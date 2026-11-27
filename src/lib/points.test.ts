import { describe, expect, it } from "vitest";
import {
  award,
  BOARD_ROWS,
  boardRows,
  LEVEL_FLOORS,
  levelFor,
  NICKNAME,
  type PointsRow,
  solvePoints,
} from "./points.ts";

const row = (kind: PointsRow["kind"], day: string, item = "sum-1"): PointsRow => ({
  item,
  kind,
  day,
  points: 0,
});

describe("solvePoints", () => {
  it("pays 10 per level for an exercise and 5 for a drill, half with help", () => {
    expect([1, 2, 3].map((l) => solvePoints("exercise", l, false))).toEqual([10, 20, 30]);
    expect(solvePoints("exercise", 3, true)).toBe(15);
    expect([1, 2, 3].map((l) => solvePoints("drill", l, false))).toEqual([5, 10, 15]);
    expect(solvePoints("drill", 1, true)).toBe(2);
  });
});

describe("award", () => {
  const solve = { kind: "exercise" as const, item: "sum-1", level: 2, helped: false };

  it("pays the first solve once", () => {
    expect(award({ ...solve, day: "2026-11-27" }, [])).toEqual([
      { item: "sum-1", kind: "solve", day: "2026-11-27", points: 20 },
    ]);
    expect(award({ ...solve, day: "2026-11-27" }, [row("solve", "2026-11-27")])).toEqual([]);
    expect(award({ ...solve, day: "2026-11-27" }, [row("backfill", "2026-11-20")])).toHaveLength(1);
  });

  it("pays a review only once it is due, with growing gaps", () => {
    const first = [row("solve", "2026-11-20")];
    expect(award({ ...solve, day: "2026-11-21" }, first)).toEqual([
      { item: "sum-1", kind: "review", day: "2026-11-21", points: 5 },
    ]);
    const once = [...first, row("review", "2026-11-21")];
    expect(award({ ...solve, day: "2026-11-23" }, once)).toEqual([]);
    expect(award({ ...solve, day: "2026-11-24" }, once)).toHaveLength(1);
  });

  it("pays the daily on its own day only, with the bonus, and never twice a day", () => {
    const daily = { kind: "daily" as const, item: "d-1", level: 1, helped: false };
    expect(award({ ...daily, day: "2026-11-27", isPick: false }, [])).toEqual([]);
    expect(award({ ...daily, day: "2026-11-27", isPick: true }, [])).toEqual([
      { item: "d-1", kind: "daily", day: "2026-11-27", points: 20 },
    ]);
    expect(
      award({ ...daily, day: "2026-11-27", isPick: true }, [], [row("daily", "2026-11-27", "x")]),
    ).toEqual([]);
  });

  it("adds the streak bonus on the 7th and 14th daily in a row only", () => {
    const daily = { kind: "daily" as const, item: "d-1", level: 1, helped: true, isPick: true };
    const days = (n: number) =>
      Array.from({ length: n }, (_, i) => row("daily", `2026-11-${String(10 + i)}`, "x"));
    expect(award({ ...daily, day: "2026-11-16" }, [], days(6)).map((r) => r.kind)).toEqual([
      "daily",
      "streak",
    ]);
    expect(award({ ...daily, day: "2026-11-15" }, [], days(5))).toHaveLength(1);
    expect(award({ ...daily, day: "2026-11-23" }, [], days(13)).at(-1)).toEqual({
      item: "streak",
      kind: "streak",
      day: "2026-11-23",
      points: 25,
    });
  });
});

describe("levelFor", () => {
  it("starts at level 1 and tops out at 20", () => {
    expect(levelFor(0)).toEqual({ level: 1, title: "Beginner", floor: 0, next: 100 });
    expect(levelFor(99).level).toBe(1);
    expect(levelFor(100).level).toBe(2);
    expect(levelFor(400)).toMatchObject({ level: 4, title: "Learner" });
    expect(levelFor(1500)).toMatchObject({ level: 8, title: "Practitioner" });
    expect(levelFor(3000)).toMatchObject({ level: 12, title: "Analyst" });
    expect(levelFor(5000)).toMatchObject({ level: 16, title: "Expert" });
    expect(levelFor(99_999)).toEqual({ level: 20, title: "Master", floor: 7000, next: null });
  });

  it("needs more points for each level than the last", () => {
    const gaps = LEVEL_FLOORS.slice(1).map((f, i) => f - (LEVEL_FLOORS[i] ?? 0));
    expect(gaps.every((g, i) => i === 0 || g >= (gaps[i - 1] ?? 0))).toBe(true);
  });
});

describe("NICKNAME", () => {
  it("takes 3 to 20 letters, digits and underscores", () => {
    expect(["ann", "Sheet_Wizard_2026"].every((n) => NICKNAME.test(n))).toBe(true);
    expect(["an", "a b", "a".repeat(21), "anna@x", "émile"].some((n) => NICKNAME.test(n))).toBe(
      false,
    );
  });
});

describe("boardRows", () => {
  const top = Array.from({ length: BOARD_ROWS }, (_, i) => ({
    rank: i + 1,
    nickname: `n${i + 1}`,
    points: 100 - i * 10,
    level: 1,
  }));
  const me = (nickname: string | null, rank: number | null, points: number) => ({
    nickname,
    rank,
    points,
    level: 1,
  });

  it("marks a learner who is in the list", () => {
    const { rows, pinned } = boardRows(top, me("n4", 4, 70));
    expect(rows).toHaveLength(BOARD_ROWS);
    expect(rows.filter((r) => r.mine).map((r) => r.nickname)).toEqual(["n4"]);
    expect(pinned).toBe(false);
  });

  it("gives a learner without a nickname their place and keeps six rows", () => {
    const { rows, pinned } = boardRows(top, me(null, 3, 85));
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows[2]?.mine).toBe(true);
    expect(rows.at(-1)?.nickname).toBe("n5");
    expect(pinned).toBe(false);
  });

  it("lists five and pins a learner below sixth place or with no points", () => {
    for (const m of [me("late", 7, 5), me(null, 14, 1), me(null, null, 0)]) {
      const { rows, pinned } = boardRows(top, m);
      expect(rows).toHaveLength(BOARD_ROWS - 1);
      expect(pinned).toBe(true);
    }
  });

  it("lists six for a visitor who is signed out", () => {
    const { rows, pinned } = boardRows(top, null);
    expect(rows).toHaveLength(BOARD_ROWS);
    expect(pinned).toBe(false);
  });

  it("pins no empty row on a board that is not full", () => {
    expect(boardRows([], me(null, null, 0)).pinned).toBe(false);
  });
});
