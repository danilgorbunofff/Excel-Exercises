import { describe, expect, it } from "vitest";
import { drillQueue, RANDOM_SIZE } from "./drills.ts";

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
