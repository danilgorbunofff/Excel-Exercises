// Runs every worked example on the function pages through the grader, so a
// page never shows a result the formula would not give.
import { readdirSync, readFileSync } from "node:fs";
import { grade, parseAddress } from "@practice/grader";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { functionSchema } from "./schema.ts";

const dir = "content/functions";
const pages = readdirSync(dir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => ({
    file: f,
    page: functionSchema.parse(parse(readFileSync(`${dir}/${f}`, "utf8"))),
  }));

describe("function pages", () => {
  it("finds the function pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(2);
  });

  for (const { file, page } of pages) {
    for (const ex of page.examples) {
      it(`${file}: ${ex.formula} gives ${ex.result}`, () => {
        const at = parseAddress(ex.cell);
        expect(at && ex.rows[at.row - 1]?.[at.col - 1]).toBeNull();
        const verdict = grade(ex.formula, {
          rows: ex.rows,
          answerCell: ex.cell,
          expected: ex.result,
          requiredFunctions: [page.name],
          forbiddenFunctions: [],
          requireReference: false,
        });
        expect(verdict).toMatchObject({ correct: true });
      });
    }
  }
});
