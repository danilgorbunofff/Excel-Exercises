import { describe, expect, it } from "vitest";
import { validateContent } from "./validate-content.ts";

const screen = {
  prompt: "Add up the sales in B2 to B3.",
  rows: [
    ["Month", "Sales"],
    ["Jan", 1],
    ["Feb", 2],
    ["Total", null],
  ],
  answerCell: "B4",
  expected: 3,
  answer: "=SUM(B2:B3)",
  requiredFunctions: ["SUM"],
  hints: { nudge: "Use SUM.", rule: "SUM adds a range." },
  misses: { reference: "Point at the cells.", value: "Check the range." },
  accept: ["=SUM(B2:B3)"],
  reject: [{ formula: "=1+2", rule: "reference" }],
};
const exercise = (id: string, topic = "basics") => ({
  file: `${id}.yaml`,
  data: {
    id,
    slug: id,
    level: 1,
    title: "Sum two cells",
    topic,
    updated: "2026-11-10",
    checkedInExcel: null,
    screens: [structuredClone(screen)],
    notes: { summary: "Adds numbers.", syntax: "SUM(a, b)", example: "Sum.", commonErrors: ["A"] },
  },
});
const track = {
  file: "track.yaml",
  data: {
    topics: [{ slug: "basics", title: "Basics", summary: "Start here." }],
    order: ["a", "b"],
  },
};

describe("validateContent", () => {
  it("accepts valid content", () => {
    expect(validateContent([exercise("a"), exercise("b")], track)).toEqual([]);
  });

  it("accepts dates read as Date objects as well as strings", () => {
    const a = exercise("a") as { data: Record<string, unknown> };
    a.data["updated"] = new Date("2026-11-10T00:00:00Z");
    expect(validateContent([a as ReturnType<typeof exercise>, exercise("b")], track)).toEqual([]);
  });

  it("reports schema errors with the file and the field path", () => {
    const bad = exercise("a");
    (bad.data.screens[0] as { answerCell: string }).answerCell = "b4";
    const errors = validateContent([bad, exercise("b")], track);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("a.yaml");
    expect(errors[0]).toContain("screens.0.answerCell");
  });

  it("requires every exercise in the track order exactly once", () => {
    const errors = validateContent([exercise("a"), exercise("b"), exercise("c")], {
      ...track,
      data: { ...track.data, order: ["a", "b", "b", "z"] },
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('"b" appears 2 times'),
        expect.stringContaining('"z" has no exercise file'),
        expect.stringContaining('"c" is not in the track order'),
      ]),
    );
  });

  it("requires a known topic and unique slugs", () => {
    const b = exercise("b", "lookups");
    b.data.slug = "a";
    const errors = validateContent([exercise("a"), b], track);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unknown topic "lookups"'),
        expect.stringContaining('slug "a" is used by more than one exercise'),
      ]),
    );
  });

  it("requires a rectangular grid with the answer cell empty and inside it", () => {
    const a = exercise("a");
    const b = exercise("b");
    const c = exercise("c");
    (a.data.screens[0] as { rows: unknown[][] }).rows[1] = ["Jan"];
    (b.data.screens[0] as { answerCell: string }).answerCell = "B2";
    (c.data.screens[0] as { answerCell: string }).answerCell = "C9";
    const errors = validateContent([a, b, c], {
      ...track,
      data: { ...track.data, order: ["a", "b", "c"] },
    });
    expect(errors).toEqual([
      "a.yaml: screens.0.rows.1: every row needs 2 cells, like the first row",
      "b.yaml: screens.0.answerCell: must be an empty cell",
      "c.yaml: screens.0.answerCell: is outside the grid",
    ]);
  });

  it("requires miss text for each rejected rule and known functions", () => {
    const a = exercise("a");
    const s = a.data.screens[0] as Record<string, unknown>;
    s["reject"] = [
      { formula: "=SUM(B2:B2)", rule: "value" },
      { formula: "=SUM(", rule: "syntax" },
    ];
    s["requiredFunctions"] = ["SUMM"];
    s["forbiddenFunctions"] = [];
    const errors = validateContent([a, exercise("b")], track);
    expect(errors).toEqual(
      expect.arrayContaining([
        "a.yaml: screens.0.requiredFunctions.0: the grader does not know this function",
        "a.yaml: screens.0.reject.1.rule: add misses.syntax, the text shown after this kind of miss",
      ]),
    );
    expect(errors).toHaveLength(2);
  });

  it("rejects a function that is both required and forbidden", () => {
    const a = exercise("a");
    (a.data.screens[0] as Record<string, unknown>)["forbiddenFunctions"] = ["SUM"];
    expect(validateContent([a, exercise("b")], track)).toEqual([
      "a.yaml: screens.0.forbiddenFunctions: SUM is both required and forbidden",
    ]);
  });

  it("reports a topic with no exercises", () => {
    const errors = validateContent([exercise("a"), exercise("b")], {
      ...track,
      data: {
        ...track.data,
        topics: [...track.data.topics, { slug: "lookups", title: "Lookups", summary: "Find." }],
      },
    });
    expect(errors).toEqual(['track.yaml: topic "lookups" has no exercises']);
  });
});

describe("validateContent: function pages", () => {
  const fn = (over: Record<string, unknown> = {}) => ({
    file: "sum.yaml",
    data: {
      name: "SUM",
      slug: "sum",
      summary: "Adds numbers.",
      syntax: "SUM(number1, ...)",
      arguments: [{ name: "number1", required: true, description: "A number." }],
      returns: "A number.",
      examples: [
        {
          title: "Add",
          rows: [[1, null]],
          cell: "B1",
          formula: "=SUM(A1)",
          result: 1,
          explanation: "Adds.",
        },
      ],
      pitfalls: [{ title: "Short range", text: "Check the range." }],
      about: ["Adds numbers."],
      tips: ["Check the range."],
      questions: [{ q: "Why is the total small?", a: "The range stops short." }],
      alternatives: [],
      related: ["AVERAGE"],
      versions: "Every version.",
      checked: {
        source: "Docs",
        url: "https://example.com/sum",
        date: "2026-11-11",
        covers: "Syntax.",
      },
      exercise: "a",
      updated: "2026-11-11",
      ...over,
    },
  });

  it("accepts a valid page", () => {
    expect(validateContent([exercise("a"), exercise("b")], track, [fn()])).toEqual([]);
  });

  it("needs a known exercise, a matching slug and one page per function", () => {
    const errors = validateContent([exercise("a"), exercise("b")], track, [
      fn({ exercise: "zzz", slug: "summ" }),
      fn(),
    ]);
    expect(errors).toEqual([
      'sum.yaml: slug should be "sum"',
      'sum.yaml: exercise "zzz" has no exercise file',
      "sum.yaml: SUM also has a page in sum.yaml",
    ]);
  });
});
