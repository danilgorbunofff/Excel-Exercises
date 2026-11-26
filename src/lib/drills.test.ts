import { describe, expect, it } from "vitest";
import {
  drillQueue,
  freeRunSlugs,
  functionResults,
  RANDOM_SIZE,
  sessionStep,
  taskState,
} from "./drills.ts";

const pool = ["IF", "SUM", "XLOOKUP"].flatMap((fn) =>
  [1, 2, 3, 4, 5].map((n) => ({ id: `${fn}-${n}`, slug: `${fn}-${n}`, fn, level: n <= 2 ? 1 : 2 })),
);
const ids = (q: { id: string }[]) => q.map((d) => d.id);

describe("drillQueue", () => {
  it("plays the chosen functions in the order chosen, each easy to hard", () => {
    expect(ids(drillQueue(pool, { fns: ["SUM", "IF", "SUM"], id: null }))).toEqual([
      "SUM-1",
      "SUM-2",
      "SUM-3",
      "SUM-4",
      "SUM-5",
      "IF-1",
      "IF-2",
      "IF-3",
      "IF-4",
      "IF-5",
    ]);
  });

  it("plays one drill by id, and nothing for an unknown choice", () => {
    expect(ids(drillQueue(pool, { fns: ["SUM"], id: "IF-3" }))).toEqual(["IF-3"]);
    expect(drillQueue(pool, { fns: ["NOPE"], id: null })).toEqual([]);
    expect(drillQueue(pool, { fns: [], id: null })).toEqual([]);
  });

  it("shuffles every drill for all, and takes ten for random", () => {
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const all = drillQueue(pool, { fns: ["all"], id: null }, random);
    expect(all).toHaveLength(pool.length);
    expect(new Set(ids(all))).toEqual(new Set(ids(pool)));
    expect(ids(all)).not.toEqual(ids(pool));
    const some = drillQueue(pool, { fns: ["random"], id: null }, random);
    expect(some).toHaveLength(RANDOM_SIZE);
    expect(new Set(ids(some)).size).toBe(RANDOM_SIZE);
  });
});

describe("sessionStep", () => {
  it("gives the place and the neighbours, or -1 outside the session", () => {
    expect(sessionStep(["a", "b", "c"], "a")).toEqual({ index: 0, prev: null, next: "b" });
    expect(sessionStep(["a", "b", "c"], "b")).toEqual({ index: 1, prev: "a", next: "c" });
    expect(sessionStep(["a", "b", "c"], "c")).toEqual({ index: 2, prev: "b", next: null });
    expect(sessionStep(["a"], "z")).toEqual({ index: -1, prev: null, next: null });
    // A review run mixes exercise and drill pages, matched by address.
    const run = ["/exercises/add-two-cells/", "/exercises/drills/sum-drill-1/"];
    expect(sessionStep(run, "/exercises/drills/sum-drill-1/")).toEqual({
      index: 1,
      prev: "/exercises/add-two-cells/",
      next: null,
    });
  });
});

describe("freeRunSlugs", () => {
  it("takes ten distinct slugs from the pool", () => {
    const slugs = freeRunSlugs(pool);
    expect(slugs).toHaveLength(RANDOM_SIZE);
    expect(new Set(slugs).size).toBe(RANDOM_SIZE);
    for (const s of slugs) expect(pool.some((d) => d.slug === s)).toBe(true);
  });
});

describe("a run's results", () => {
  it("tells a first-try solve from a later one, an unsolved task and an unopened one", () => {
    expect([
      taskState({ solved: true }, false),
      taskState({ solved: true }, true),
      taskState({ solved: false }, false),
      taskState(undefined, true),
    ]).toEqual(["correct", "retry", "open", "none"]);
  });

  it("counts each function over its opened tasks and weighs the weak ones higher", () => {
    expect(
      functionResults([
        { fn: "SUM", state: "correct" },
        { fn: "SUM", state: "retry" },
        { fn: "SUM", state: "open" },
        { fn: "SUM", state: "none" },
        { fn: "MAX", state: "none" },
      ]),
    ).toEqual([
      { fn: "SUM", total: 4, seen: 3, solved: 2, first: 1, weight: 1 },
      { fn: "MAX", total: 1, seen: 0, solved: 0, first: 0, weight: 0 },
    ]);
  });
});
