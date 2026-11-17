// Runs every exercise's accepted and rejected formulas through the grader.
// An accepted formula must be correct; a rejected one must fail on the rule
// its fixture names. This is the contract between content and grader. Every
// verdict a reject fixture produces goes into a reviewed snapshot, so a change
// to what learners read shows up as a diff.
import { readdirSync, readFileSync } from "node:fs";
import { grade } from "@practice/grader";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { lintText } from "../../tools/lib/copy-lint.ts";
import { dailySchema, drillSchema, exerciseSchema, mockSchema } from "./schema.ts";

const dir = "content/exercises";
const exercises = [
  ...readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => ({
      file: f,
      exercise: exerciseSchema.parse(parse(readFileSync(`${dir}/${f}`, "utf8"))),
    })),
  // Daily-only tasks, labelled daily/ so their verdict lines stand apart.
  ...readdirSync("content/daily")
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => ({
      file: `daily/${f}`,
      exercise: dailySchema.parse(parse(readFileSync(`content/daily/${f}`, "utf8"))),
    })),
  // Held-out mock assessment tasks, labelled mocks/.
  ...readdirSync("content/mocks")
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => ({
      file: `mocks/${f}`,
      exercise: mockSchema.parse(parse(readFileSync(`content/mocks/${f}`, "utf8"))),
    })),
  // PRO function drills, labelled drills/.
  ...readdirSync("content/drills")
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => ({
      file: `drills/${f}`,
      exercise: drillSchema.parse(parse(readFileSync(`content/drills/${f}`, "utf8"))),
    })),
];

const specOf = (screen: (typeof exercises)[number]["exercise"]["screens"][number]) => ({
  rows: screen.rows,
  answerCell: screen.answerCell,
  expected: screen.expected,
  requiredFunctions: screen.requiredFunctions,
  forbiddenFunctions: screen.forbiddenFunctions,
  requireReference: screen.requireReference,
  ...(screen.variants ? { variants: screen.variants } : {}),
});

describe("exercise fixtures", () => {
  it("finds exercise files", () => {
    expect(exercises.length).toBeGreaterThan(0);
  });

  for (const { file, exercise } of exercises) {
    exercise.screens.forEach((screen, i) => {
      const spec = specOf(screen);
      describe(`${file} screen ${i + 1}`, () => {
        it("the reference answer is correct", () => {
          expect(grade(screen.answer, spec)).toMatchObject({ correct: true });
        });
        for (const formula of screen.accept) {
          it(`accepts ${formula}`, () => {
            expect(grade(formula, spec)).toMatchObject({ correct: true });
          });
        }
        for (const { formula, rule } of screen.reject) {
          it(`rejects ${formula} on ${rule}`, () => {
            expect(grade(formula, spec)).toMatchObject({ correct: false, rule });
          });
        }
      });
    });
  }
});

describe("verdicts learners see on the seed exercises", () => {
  const lines = exercises.flatMap(({ file, exercise }) =>
    exercise.screens.flatMap((screen, i) =>
      screen.reject.map(({ formula }) => {
        const v = grade(formula, specOf(screen));
        return `${file} ${i + 1} | ${formula} | ${v.rule} | ${v.message} | ${screen.misses[v.rule ?? "value"]}`;
      }),
    ),
  );

  it("follow the copy rules", () => {
    const issues = lines.flatMap((line) => {
      const [, , , message = "", miss = ""] = line.split(" | ");
      return [...lintText(message, line), ...lintText(miss, line)];
    });
    expect(issues).toEqual([]);
  });

  it("match the reviewed snapshot", async () => {
    await expect(`${lines.join("\n")}\n`).toMatchFileSnapshot("__snapshots__/verdicts.txt");
  });
});
