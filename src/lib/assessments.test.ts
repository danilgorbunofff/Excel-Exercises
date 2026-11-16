import { readFileSync } from "node:fs";
import type { GradeSpec } from "@practice/grader";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { assessmentsSchema, trackSchema } from "../content/schema.ts";
import {
  checkAssessments,
  cleanAttempt,
  coverOf,
  gradeAttempt,
  loadAssessments,
  type SpecFor,
  skillsOf,
} from "./assessments.ts";

const facts = [
  { id: "a", locked: false, screens: 1 },
  { id: "b", locked: false, screens: 2 },
  { id: "p", locked: true, screens: 1 },
];
const parse = (sets: unknown) => assessmentsSchema.parse({ sets });

describe("checkAssessments", () => {
  it("accepts the real file", () => {
    expect(loadAssessments().sets.some((s) => s.sample)).toBe(true);
  });

  it("every assessment a track links to exists, and each interview track links one", () => {
    const track = trackSchema.parse(parseYaml(readFileSync("content/track.yaml", "utf8")));
    const slugs = new Set(loadAssessments().sets.map((s) => s.slug));
    const interview = track.topics.filter((t) => t.group === "interview");
    expect(interview.length).toBeGreaterThan(0);
    for (const t of interview) expect(t.assessment).toBeDefined();
    for (const t of track.topics) if (t.assessment) expect(slugs).toContain(t.assessment);
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
  // Two tiny screens: A1 + A2 in B1, and the larger of A1 and A2 in B1.
  const spec = (expected: number, fn: string): GradeSpec => ({
    rows: [[2], [5]],
    answerCell: "B1",
    expected,
    requiredFunctions: [fn],
    forbiddenFunctions: [],
    requireReference: true,
  });
  const specs: Record<string, GradeSpec> = { "a#0": spec(7, "SUM"), "b#1": spec(5, "MAX") };
  const specFor: SpecFor = (exercise, screen) => specs[`${exercise}#${screen}`] ?? null;
  const good = {
    assessment: "s",
    startedAt: "2026-11-15T10:00:00.000Z",
    finishedAt: "2026-11-15T10:08:00.000Z",
    timeLimit: 600,
    score: 99,
    // The browser's own marks are ignored: only the formulas count.
    results: [
      { exercise: "a", screen: 0, correct: true, rule: null },
      { exercise: "b", screen: 1, correct: true, rule: null },
    ],
    formulas: ["=SUM(A1:A2)", "=MIN(A1:A2)"],
    startToken: null,
  };

  it("marks the formulas on the server and ignores the browser's marks", () => {
    const attempt = cleanAttempt(good, sets, specFor);
    expect(attempt).toMatchObject({ assessment: "s", score: 1, total: 2, timeLimit: 600 });
    expect(attempt?.results[0]).toEqual({ exercise: "a", screen: 0, correct: true, rule: null });
    expect(attempt?.results[1]?.correct).toBe(false);
    expect(attempt?.results[1]?.rule).not.toBeNull();
    expect(attempt?.formulas).toEqual(good.formulas);
  });

  it("counts a blank formula as missed with no rule", () => {
    const attempt = cleanAttempt({ ...good, formulas: ["  ", "=MAX(A1:A2)"] }, sets, specFor);
    expect(attempt?.results[0]).toMatchObject({ correct: false, rule: null });
    expect(attempt?.score).toBe(1);
  });

  it("accepts an untimed attempt", () => {
    expect(cleanAttempt({ ...good, timeLimit: null }, sets, specFor)?.timeLimit).toBeNull();
  });

  it("keeps a well-formed start token and drops anything else", () => {
    const token = `${Date.UTC(2026, 10, 15)}.${"a".repeat(43)}`;
    expect(cleanAttempt({ ...good, startToken: token }, sets, specFor)?.startToken).toBe(token);
    expect(cleanAttempt({ ...good, startToken: "x.y" }, sets, specFor)?.startToken).toBeNull();
  });

  it("rejects an unknown set, the wrong formulas, a wrong limit and bad dates", () => {
    expect(cleanAttempt({ ...good, assessment: "x" }, sets, specFor)).toBeNull();
    expect(cleanAttempt({ ...good, formulas: ["=1"] }, sets, specFor)).toBeNull();
    expect(cleanAttempt({ ...good, formulas: ["=1", 2] }, sets, specFor)).toBeNull();
    expect(cleanAttempt({ ...good, formulas: ["=1", "x".repeat(2001)] }, sets, specFor)).toBeNull();
    expect(cleanAttempt({ ...good, formulas: undefined }, sets, specFor)).toBeNull();
    expect(cleanAttempt({ ...good, timeLimit: 60 }, sets, specFor)).toBeNull();
    expect(
      cleanAttempt({ ...good, finishedAt: "2026-11-15T09:00:00.000Z" }, sets, specFor),
    ).toBeNull();
    expect(cleanAttempt({ ...good, startedAt: "yesterday" }, sets, specFor)).toBeNull();
    expect(cleanAttempt(null, sets, specFor)).toBeNull();
  });

  it("rejects an attempt whose task has no grading spec", () => {
    expect(cleanAttempt(good, sets, () => null)).toBeNull();
  });
});

describe("gradeAttempt", () => {
  it("is the score a certificate is checked against", () => {
    const set = parse([
      { slug: "s", title: "S", summary: "S.", minutes: 5, sample: true, tasks: ["a"] },
    ]).sets[0];
    const spec: GradeSpec = {
      rows: [[2], [5]],
      answerCell: "B1",
      expected: 7,
      requiredFunctions: ["SUM"],
      forbiddenFunctions: [],
      requireReference: true,
    };
    expect(set && gradeAttempt(set, ["=SUM(A1:A2)"], () => spec)?.score).toBe(1);
    expect(set && gradeAttempt(set, ["=7"], () => spec)?.score).toBe(0);
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
      ["a", { level: 1, screens: [{ requiredFunctions: ["SUM"], answer: "=SUM(B2:B5)" }] }],
      [
        "b",
        {
          level: 3,
          screens: [
            { requiredFunctions: [], answer: "=B2" },
            { requiredFunctions: ["VLOOKUP", "SUM"], answer: "=SUM(VLOOKUP(E2,A2:C5,3,FALSE))" },
          ],
        },
      ],
      ["a2", { level: 1, screens: [{ requiredFunctions: [], answer: "=B2*B3" }] }],
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

describe("skillsOf", () => {
  it("uses the required functions, or else the functions in the answer", () => {
    expect(skillsOf({ requiredFunctions: ["SUMIF"], answer: "=SUMIF(A2:A9,E2,C2:C9)" })).toEqual([
      "SUMIF",
    ]);
    expect(
      skillsOf({ requiredFunctions: [], answer: "=ROUND(SUMIFS(C2:C9,A2:A9,E2)/SUM(C2:C9),2)" }),
    ).toEqual(["ROUND", "SUMIFS", "SUM"]);
    expect(skillsOf({ requiredFunctions: [], answer: "=B2-B3" })).toEqual([]);
  });
});

describe("checkAssessments and mock tasks", () => {
  const facts = [
    { id: "free", locked: false, screens: 1 },
    { id: "practice", locked: true, screens: 1 },
    { id: "m1", locked: true, screens: 1, mock: true },
    { id: "m2", locked: true, screens: 1, mock: true },
  ];
  const set = (slug: string, tasks: string[], sample = false) => ({
    slug,
    title: "Set",
    summary: "A set.",
    minutes: 10,
    sample,
    tasks: tasks.map((exercise) => ({ exercise, screen: 0 })),
  });
  it("needs held-out tasks in timed sets, each in one set, and every one used", () => {
    expect(
      checkAssessments({ sets: [set("s", ["free"], true), set("a", ["m1", "m2"])] }, facts),
    ).toEqual([]);
    expect(
      checkAssessments({ sets: [set("s", ["free"], true), set("a", ["m1", "practice"])] }, facts),
    ).toEqual([
      'a: "practice" is a practice exercise; a timed set uses held-out mock tasks',
      'mock task "m2" is in no set',
    ]);
    expect(
      checkAssessments(
        { sets: [set("s", ["free"], true), set("a", ["m1", "m2"]), set("b", ["m2"])] },
        facts,
      ),
    ).toEqual(['b: mock task "m2" is already in another set']);
  });
});
