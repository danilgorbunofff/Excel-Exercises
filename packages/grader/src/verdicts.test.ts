// The golden snapshot of every verdict sentence the grader can produce for a
// fixed corpus. It must change only for an intended grader change, and its
// diff is reviewed. Every sentence must also pass the site's copy rules.
import { describe, expect, it } from "vitest";
import { lintText } from "../../../tools/lib/copy-lint.ts";
import { type GradeSpec, grade } from "./grade.ts";

const sales: GradeSpec = {
  rows: [
    ["Month", "Sales"],
    ["Jan", 120],
    ["Feb", 95],
    ["Mar", 143],
    ["Apr", 88],
    ["Total", null],
  ],
  answerCell: "B6",
  expected: 446,
  requiredFunctions: ["SUM"],
  forbiddenFunctions: ["SUMIF"],
  requireReference: true,
};
const lookup: GradeSpec = {
  rows: [
    ["Code", "Price"],
    [101, 1.5],
    [102, 4],
    [105, 12],
    ["Find", 102],
    ["Price", null],
  ],
  answerCell: "B6",
  expected: 4,
  requiredFunctions: ["XLOOKUP"],
  forbiddenFunctions: ["VLOOKUP"],
  requireReference: true,
};
const label: GradeSpec = {
  rows: [
    ["Score", 72],
    ["Result", null],
  ],
  answerCell: "B2",
  expected: "Pass",
  requiredFunctions: ["IF"],
  forbiddenFunctions: [],
  requireReference: true,
};

const CORPUS: [string, GradeSpec, string[]][] = [
  [
    "sales",
    sales,
    [
      "=SUM(B2:B5)",
      "=SUM(B2:B4)",
      "=SUM(B2:B6)",
      "=SUM(B:B)",
      "=SUM(120,95,143,88)",
      "=SUM(446)",
      "=B2+B3+B4+B5",
      '=SUMIF(B2:B5,">0")+SUM(B1)',
      "=SUMM(B2:B5)",
      '=SUM(B2:B5)+CONVERT(0,"m","km")',
      "=SUM(B2:B5",
      "=SUM(B2:B5))",
      "=SUM B2:B5",
      "SUM(B2:B5)",
      "=",
      "=SUM(B2;B5)",
      "=SUM(B2:B5)/0",
      "=SUM(B2:B5)+B2:B3",
      '=SUM(B2:B5)&""',
      "=SUM(B2:B5)*total",
      "=ROUND(SUM(B2:B5))",
      "=ABS(SUM(B2:B5),1)",
      "=SUM(B2:B5) B6",
      "=SUM(B2:B5)+",
      "=*SUM(B2:B5)",
      "=SUM(Sheet1!B2:B5)",
      "=SUM(“B2”)",
      '=SUM("B2:B5)',
      "=SUM(B2:B5)@",
      "=()",
      "=1,2",
      "=SUM(B2:)",
    ],
  ],
  [
    "lookup",
    lookup,
    [
      "=XLOOKUP(B5,A2:A4,B2:B4)",
      "=XLOOKUP(102,A2:A4,B2:B4)",
      "=XLOOKUP(B5,A2:A4,B2:B3)",
      "=XLOOKUP(B4,A2:A4,B2:B4)",
      "=XLOOKUP(A5,A2:A4,B2:B4)",
      "=VLOOKUP(B5,A2:B4,2,FALSE)",
      "=INDEX(B2:B4,MATCH(B5,A2:A4,0))",
      "=XLOOKUP(B5,A2:A4,A2:B4)",
    ],
  ],
  [
    "label",
    label,
    [
      '=IF(B1>=60,"Pass","Fail")',
      '=IF(B1>=60,"pass","fail")',
      "=IF(B1>=60,Pass,Fail)",
      '=IF(72>=60,"Pass","Fail")',
      "=B1",
      '=IF(B1>=80,"Pass","Fail")',
      "=IF(B1)",
    ],
  ],
];

const verdicts = CORPUS.flatMap(([name, spec, formulas]) =>
  formulas.map((f) => {
    const v = grade(f, spec);
    const span = v.start === undefined ? "" : ` [${v.start}-${v.end}]`;
    return {
      line: `${name} | ${f} | ${v.rule ?? "correct"}${span} | ${v.message}`,
      message: v.message,
    };
  }),
);

describe("verdict sentences", () => {
  it("match the reviewed golden file", async () => {
    await expect(`${verdicts.map((v) => v.line).join("\n")}\n`).toMatchFileSnapshot(
      "./__snapshots__/verdicts.txt",
    );
  });

  it.each(verdicts.map((v) => [v.message]))("follows the copy rules: %s", (message) => {
    expect(lintText(message)).toEqual([]);
  });
});
