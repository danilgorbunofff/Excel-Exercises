import { describe, expect, it } from "vitest";
import {
  type CatalogueRow,
  compare,
  countLine,
  exerciseAction,
  matches,
  trackStatus,
} from "./catalogue.ts";

const row = (o: Partial<CatalogueRow>): CatalogueRow => ({
  order: 1,
  title: "Add two cells",
  level: 1,
  track: "references",
  search: "add two cells",
  functions: [],
  state: "",
  ...o,
});
const none = { q: "", fn: "", level: "", track: "", progress: "" } as const;

describe("catalogue filter", () => {
  it("matches every word, level, track and progress", () => {
    expect(matches(row({}), { ...none, q: "two add" })).toBe(true);
    expect(matches(row({}), { ...none, q: "sum" })).toBe(false);
    expect(matches(row({}), { ...none, level: "2" })).toBe(false);
    expect(matches(row({}), { ...none, track: "totals" })).toBe(false);
    expect(matches(row({ state: "helped" }), { ...none, progress: "done" })).toBe(true);
    expect(matches(row({ state: "revealed" }), { ...none, progress: "todo" })).toBe(true);
  });
  it("matches a function by its whole name, not as part of a word", () => {
    const scores = row({ title: "Average score", search: "average score", functions: ["AVERAGE"] });
    const either = row({ title: "Free delivery", search: "free delivery or", functions: ["OR"] });
    const countif = row({
      title: "Count orders",
      search: "count orders countif",
      functions: ["COUNTIF"],
    });
    expect(matches(scores, { ...none, fn: "OR" })).toBe(false);
    expect(matches(either, { ...none, fn: "or" })).toBe(true);
    expect(matches(countif, { ...none, fn: "IF" })).toBe(false);
    expect(matches(countif, { ...none, fn: "COUNTIF" })).toBe(true);
  });
});

describe("catalogue sort", () => {
  const a = row({ order: 1, title: "Zeta", level: 2, state: "" });
  const b = row({ order: 2, title: "Alpha", level: 1, state: "solved" });
  it("sorts by each key, ties by track order", () => {
    expect([a, b].sort((x, y) => compare(x, y, "title", "ascending"))[0]).toBe(b);
    expect([a, b].sort((x, y) => compare(x, y, "level", "descending"))[0]).toBe(a);
    expect([a, b].sort((x, y) => compare(x, y, "state", "ascending"))[0]).toBe(b);
    expect([b, a].sort((x, y) => compare(x, y, "order", "ascending"))[0]).toBe(a);
  });
  it("says how many rows show", () => {
    expect(countLine(3, 24, false)).toBe("");
    expect(countLine(2, 24, true)).toBe("Showing 2 of 24 exercises.");
    expect(countLine(0, 24, true)).toBe("No exercise matches. Try a function name such as SUM.");
  });
});

describe("track status", () => {
  it("names the state and the next action from the count done", () => {
    expect(trackStatus(0, 4)).toEqual({
      state: "todo",
      pill: "Not started",
      action: "Start track",
    });
    expect(trackStatus(1, 4)).toEqual({
      state: "doing",
      pill: "In progress",
      action: "Continue track",
    });
    expect(trackStatus(4, 4)).toEqual({ state: "done", pill: "Completed", action: "Review track" });
  });
  it("treats an empty track as not started", () => {
    expect(trackStatus(0, 0).state).toBe("todo");
  });
});

describe("exercise action", () => {
  it("offers a solved exercise for review and any other to start", () => {
    expect(exerciseAction("solved")).toBe("Review");
    expect(exerciseAction("helped")).toBe("Review");
    expect(exerciseAction("revealed")).toBe("Start");
    expect(exerciseAction("")).toBe("Start");
  });
});
