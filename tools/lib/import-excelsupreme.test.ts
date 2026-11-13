import { describe, expect, it } from "vitest";
import { convert, type SourceExercise, topicFor } from "./import-excelsupreme.ts";

const base = (over: Partial<SourceExercise> = {}): SourceExercise => ({
  id: "04-if-pass-fail",
  slug: "if-pass-fail",
  level: 1,
  title: "IF: one test, two answers",
  screens: [
    {
      type: "formula",
      prompt: 'In C2, write "Pass" if the score in B2 is 70 or more, otherwise "Fail".',
      grid: {
        startCell: "A1",
        rows: [
          ["Student", "Score", "Result"],
          ["Ana", 72, null],
        ],
      },
      answerCell: "C2",
      expect: { value: "Pass" },
      require: [{ id: "func-if", func: "IF", minArgs: 3 }],
      forbid: [],
      hints: {
        syntax: "Close the bracket at the end.",
        "func-if": "Use IF so the label follows the score.",
        "require-ref": "The test has to read B2.",
        value: "Check the operator.",
        error: "A label without quotes gives #NAME?.",
      },
      fixtures: {
        accept: ['=IF(B2>=70,"Pass","Fail")', '=IF(B2>69,"Pass","Fail")', '=IF(TODAY()>0,"Pass")'],
        reject: [
          { formula: '=IF(B2>75,"Pass","Fail")', rule: "value", why: "boundary" },
          { formula: '="Pass"', rule: "func-if", why: "typed" },
          { formula: '=IF(B2>=70,"Pass","Fail"', rule: "syntax", why: "bracket" },
          { formula: '=IF(A2="Bo","Pass","Fail")', rule: "require-ref", why: "wrong cell" },
          { formula: '=IF(B2>=70,"Pass","Fail")&""', rule: "hardcoded", why: "passes here" },
        ],
      },
    },
  ],
  docs: {
    syntax: "=IF(logical_test, value_if_true, value_if_false)",
    explain:
      "IF takes a test and returns one of two values. The test comes first.\n\nLeave the third argument out and a false test returns FALSE.",
    errors: [{ code: "#NAME?", text: "Pass was written without quotes." }],
    reference: '=IF(B2>=70,"Pass","Fail")',
  },
  ...over,
});

describe("topicFor", () => {
  it.each([
    ["sum", ["SUM"], "totals"],
    ["sum", ["SUMIF"], "conditions"],
    ["count", ["COUNTA"], "counting"],
    ["count", ["COUNTIFS"], "conditions"],
    ["statistical", ["AVERAGE"], "totals"],
    ["statistical", ["MIN", "MAX"], "totals"],
    ["statistical", ["RANK"], "statistics"],
    ["logical", ["IF"], "logic"],
    ["date", ["DATE"], "dates"],
    ["aggregate", ["SUBTOTAL"], "subtotals"],
    ["arrays", ["UNIQUE"], null],
    ["intro", [], null],
  ])("%s with %j goes to %s", (group, fns, topic) => {
    expect(topicFor(group, fns)).toBe(topic);
  });
});

describe("convert", () => {
  it("maps the fields this site uses", () => {
    const { exercise } = convert(base(), "logic", "2026-11-11");
    expect(exercise).toMatchObject({
      id: "if-pass-fail",
      slug: "if-pass-fail",
      level: 1,
      title: "IF: one test, two answers",
      topic: "logic",
      updated: "2026-11-11",
      checkedInExcel: null,
      notes: {
        summary: "IF takes a test and returns one of two values. The test comes first.",
        syntax: "IF(logical_test, value_if_true, value_if_false)",
        example: "",
        commonErrors: ["Pass was written without quotes."],
      },
    });
    const [screen] = exercise?.screens ?? [];
    expect(screen).toMatchObject({
      prompt: 'In C2, write "Pass" if the score in B2 is 70 or more, otherwise "Fail".',
      rows: [
        ["Student", "Score", "Result"],
        ["Ana", 72, null],
      ],
      answerCell: "C2",
      expected: "Pass",
      answer: '=IF(B2>=70,"Pass","Fail")',
      requiredFunctions: ["IF"],
      forbiddenFunctions: [],
      hints: { nudge: "", rule: "" },
      misses: {
        syntax: "Close the bracket at the end.",
        "required-function": "Use IF so the label follows the score.",
        reference: "The test has to read B2.",
        value: "Check the operator.",
      },
    });
  });

  it("keeps only accepted formulas this grader accepts", () => {
    const { exercise, notes } = convert(base(), "logic", "2026-11-11");
    expect(exercise?.screens[0]?.accept).toEqual([
      '=IF(B2>=70,"Pass","Fail")',
      '=IF(B2>69,"Pass","Fail")',
    ]);
    expect(notes.join("\n")).toMatch(/dropped accept =IF\(TODAY/u);
  });

  it("files each reject under the rule this grader gives, and drops ones it accepts", () => {
    const { exercise, notes } = convert(base(), "logic", "2026-11-11");
    expect(exercise?.screens[0]?.reject).toEqual([
      { formula: '=IF(B2>75,"Pass","Fail")', rule: "value" },
      { formula: '="Pass"', rule: "required-function" },
      { formula: '=IF(B2>=70,"Pass","Fail"', rule: "syntax" },
      { formula: '=IF(A2="Bo","Pass","Fail")', rule: "value" },
    ]);
    expect(notes.join("\n")).toMatch(/dropped reject .*passes here/u);
  });

  it("maps a forbidden function and its message", () => {
    const src = base();
    const screen = src.screens[0];
    if (!screen) throw new Error("fixture");
    screen.forbid = [{ id: "no-ifs", func: "IFS" }];
    screen.hints = { ...screen.hints, "no-ifs": "Use IF here, not IFS." };
    screen.fixtures?.reject.push({ formula: '=IFS(B2>=70,"Pass",TRUE,"Fail")', rule: "no-ifs" });
    const { exercise } = convert(src, "logic", "2026-11-11");
    expect(exercise?.screens[0]?.forbiddenFunctions).toEqual(["IFS"]);
    expect(exercise?.screens[0]?.misses["forbidden-function"]).toBe("Use IF here, not IFS.");
    expect(exercise?.screens[0]?.reject).toContainEqual({
      formula: '=IFS(B2>=70,"Pass",TRUE,"Fail")',
      rule: "required-function",
    });
  });

  it("drops screens that are not formulas, and skips an exercise with none left", () => {
    const shortcut: SourceExercise["screens"][number] = { type: "chord", prompt: "Select A2:A40." };
    const mixed = convert(base({ screens: [...base().screens, shortcut] }), "logic", "2026-11-11");
    expect(mixed.exercise?.screens).toHaveLength(1);
    expect(mixed.notes.join("\n")).toMatch(/dropped a chord screen/u);
    const none = convert(base({ screens: [shortcut] }), "logic", "2026-11-11");
    expect(none.exercise).toBeNull();
  });

  it("skips an exercise that needs a function this grader does not know", () => {
    const src = base();
    const screen = src.screens[0];
    if (!screen) throw new Error("fixture");
    screen.require = [{ id: "func-today", func: "TODAY" }];
    const { exercise, notes } = convert(src, "dates", "2026-11-11");
    expect(exercise).toBeNull();
    expect(notes.join("\n")).toMatch(/TODAY/u);
  });
});
