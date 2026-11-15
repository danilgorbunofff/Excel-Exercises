import { describe, expect, it } from "vitest";
import { assessmentsSchema } from "../content/schema.ts";
import { checkAssessments, cleanAttempt, coverOf, loadAssessments } from "./assessments.ts";

const facts = [
  { id: "a", pro: false, screens: 1 },
  { id: "b", pro: false, screens: 2 },
  { id: "p", pro: true, screens: 1 },
];
const parse = (sets: unknown) => assessmentsSchema.parse({ sets });

describe("checkAssessments", () => {
  it("accepts the real file", () => {
    expect(loadAssessments().sets.some((s) => s.sample)).toBe(true);
  });

  it("reads a bare id as the first screen", () => {
    const data = parse([
      { slug: "s", title: "S", summary: "S.", minutes: 5, sample: true, tasks: ["a"] },
    ]);
    expect(data.sets[0]?.tasks).toEqual([{ exercise: "a", screen: 0 }]);
    expect(checkAssessments(data, facts)).toEqual([]);
  });

  it("reports unknown exercises, missing screens, repeats and PRO tasks in the sample", () => {
    const data = parse([
      {
        slug: "s",
        title: "S",
        summary: "S.",
        minutes: 5,
        sample: true,
        tasks: ["nope", { exercise: "b", screen: 2 }, "p", "a", "a"],
      },
    ]);
    const problems = checkAssessments(data, facts);
    expect(problems).toContain('s: no exercise "nope"');
    expect(problems).toContain('s: "b" has no screen 2');
    expect(problems).toContain('s: the free sample uses PRO exercise "p"');
    expect(problems).toContain('s: "a#0" appears twice');
  });

  it("needs one free sample", () => {
    const data = parse([{ slug: "s", title: "S", summary: "S.", minutes: 5, tasks: ["p"] }]);
    expect(checkAssessments(data, facts)).toContain("there is no free sample set");
  });
});

describe("cleanAttempt", () => {
  const sets = parse([
    {
      slug: "s",
      title: "S",
      summary: "S.",
      minutes: 10,
      tasks: ["a", { exercise: "b", screen: 1 }],
    },
  ]).sets;
  const good = {
    assessment: "s",
    startedAt: "2026-11-15T10:00:00.000Z",
    finishedAt: "2026-11-15T10:08:00.000Z",
    timeLimit: 600,
    score: 99,
    results: [
      { exercise: "a", screen: 0, correct: true, rule: null },
      { exercise: "b", screen: 1, correct: false, rule: "value" },
    ],
  };

  it("keeps a matching attempt and recounts the score", () => {
    expect(cleanAttempt(good, sets)).toMatchObject({
      assessment: "s",
      score: 1,
      total: 2,
      timeLimit: 600,
    });
  });

  it("accepts an untimed attempt", () => {
    expect(cleanAttempt({ ...good, timeLimit: null }, sets)?.timeLimit).toBeNull();
  });

  it("rejects an unknown set, the wrong tasks, a wrong limit and bad dates", () => {
    expect(cleanAttempt({ ...good, assessment: "x" }, sets)).toBeNull();
    expect(cleanAttempt({ ...good, results: good.results.slice(0, 1) }, sets)).toBeNull();
    expect(cleanAttempt({ ...good, results: [good.results[1], good.results[0]] }, sets)).toBeNull();
    expect(cleanAttempt({ ...good, timeLimit: 60 }, sets)).toBeNull();
    expect(cleanAttempt({ ...good, finishedAt: "2026-11-15T09:00:00.000Z" }, sets)).toBeNull();
    expect(cleanAttempt({ ...good, startedAt: "yesterday" }, sets)).toBeNull();
    expect(cleanAttempt(null, sets)).toBeNull();
  });

  it("drops the rule of a correct task and rejects a malformed rule", () => {
    const withRule = { ...good, results: [{ ...good.results[0], rule: "value" }, good.results[1]] };
    expect(cleanAttempt(withRule, sets)?.results[0]?.rule).toBeNull();
    const bad = { ...good, results: [good.results[0], { ...good.results[1], rule: "<b>" }] };
    expect(cleanAttempt(bad, sets)).toBeNull();
  });
});

describe("coverOf", () => {
  it("lists each task's functions and level, and the set's functions and levels once", () => {
    const set = parse([
      {
        slug: "s",
        title: "S",
        summary: "S.",
        minutes: 5,
        sample: true,
        tasks: ["a", { exercise: "b", screen: 1 }, "a2"],
      },
    ]).sets[0];
    const byId = new Map([
      ["a", { level: 1, screens: [{ requiredFunctions: ["SUM"] }] }],
      [
        "b",
        {
          level: 3,
          screens: [{ requiredFunctions: [] }, { requiredFunctions: ["VLOOKUP", "SUM"] }],
        },
      ],
      ["a2", { level: 1, screens: [{ requiredFunctions: [] }] }],
    ]);
    const cover = set && coverOf(set, byId);
    expect(cover?.tasks).toEqual([
      { functions: ["SUM"], level: 1 },
      { functions: ["VLOOKUP", "SUM"], level: 3 },
      { functions: [], level: 1 },
    ]);
    expect(cover?.functions).toEqual(["SUM", "VLOOKUP"]);
    expect(cover?.levels).toEqual([1, 3]);
  });
});
