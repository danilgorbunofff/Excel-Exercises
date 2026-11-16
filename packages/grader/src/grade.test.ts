import { describe, expect, it } from "vitest";
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
  forbiddenFunctions: [],
  requireReference: true,
};
const g = (formula: string, spec: GradeSpec = sales) => grade(formula, spec);

describe("grade: correct answers", () => {
  it.each([
    "=SUM(B2:B5)",
    "=sum(b2:b5)",
    "=SUM(B2,B3,B4,B5)",
    "=SUM($B$2:$B$5)",
    "= SUM( B2:B5 )",
    "=SUM(B5:B2)",
  ])("accepts %s", (f) => {
    expect(g(f)).toMatchObject({ correct: true, rule: null, value: 446, display: "446" });
  });

  it("reports what the formula read, from the parse tree", () => {
    expect(g("=SUM(B2:B5)").reads).toEqual([
      {
        text: "B2:B5",
        start: 5,
        end: 10,
        box: { top: 2, bottom: 5, left: 2, right: 2 },
        cells: 4,
        numbers: 4,
        sum: 446,
        includesAnswerCell: false,
      },
    ]);
  });
});

describe("grade: rules in their fixed order", () => {
  it("1. syntax comes first, even if other rules would also fail", () => {
    expect(g("=120+95+143+88+")).toMatchObject({
      correct: false,
      rule: "syntax",
      start: 14,
      end: 15,
    });
  });

  it("1. syntax covers unknown functions, argument counts and bare names", () => {
    expect(g("=SUMM(B2:B5)")).toMatchObject({
      rule: "syntax",
      message: "Excel has no function called SUMM.",
      start: 1,
      end: 5,
    });
    expect(g("=ROUND(B2)")).toMatchObject({ rule: "syntax", message: "ROUND needs 2 arguments." });
    expect(g("=IF(B2)")).toMatchObject({
      rule: "syntax",
      message: "IF needs at least 2 arguments.",
    });
    expect(g("=ABS(B2,B3)")).toMatchObject({ rule: "syntax", message: "ABS takes 1 argument." });
    expect(g("=SUM(B2:B5)*total")).toMatchObject({
      rule: "syntax",
      message: 'Excel reads total as a name. If you mean text, put it in quotes: `"total"`.',
      start: 12,
      end: 17,
    });
  });

  it("1. a name that starts with a cell address is a missing operator, not text", () => {
    expect(g("=B2xB3")).toMatchObject({
      rule: "syntax",
      message:
        "Excel reads B2xB3 as one name. To join two cells, put an operator such as `*` between them.",
      start: 1,
      end: 6,
    });
  });

  it("2. the required function must appear", () => {
    expect(g("=B2+B3+B4+B5")).toMatchObject({
      rule: "required-function",
      message: "This exercise asks for SUM, and the formula does not use it.",
    });
  });

  it("3. a forbidden function must not appear", () => {
    const spec = { ...sales, requiredFunctions: [], forbiddenFunctions: ["SUM"] };
    expect(g("=SUM(B2:B5)", spec)).toMatchObject({
      rule: "forbidden-function",
      message: "This exercise asks you to solve it without SUM.",
      start: 1,
      end: 4,
    });
  });

  it("4. the formula must point at the data, not typed numbers", () => {
    expect(g("=SUM(120,95,143,88)")).toMatchObject({
      rule: "reference",
      message:
        "You typed 120, the value in B2. Point at B2 instead, so the result updates when the data changes.",
      start: 5,
      end: 8,
    });
    expect(g("=SUM(446)")).toMatchObject({
      rule: "reference",
      message:
        "The formula uses no cells. Point at the data, so the result updates when it changes.",
    });
    expect(g("=SUM(B2:B5)+0*-88")).toMatchObject({
      rule: "reference",
      message: expect.stringContaining("You typed 88"),
    });
    // A typed negative number is named with its sign and its span covers the sign.
    const cold: GradeSpec = {
      ...sales,
      rows: [
        ["Night", "Low"],
        ["Mon", -2],
        ["Tue", 3],
        ["Min", null],
      ],
      answerCell: "B4",
      expected: -2,
      requiredFunctions: [],
    };
    expect(g("=MIN(-2,3)", cold)).toMatchObject({
      rule: "reference",
      message:
        "You typed -2, the value in B2. Point at B2 instead, so the result updates when the data changes.",
      start: 5,
      end: 7,
    });
  });

  it("4. a typed value in several cells names one the formula does not already read", () => {
    const lookup: GradeSpec = {
      rows: [
        ["ID", "Ext"],
        [1041, 214],
        [1043, 218],
        [null, null],
        ["Find", 1043],
        ["Ext", null],
      ],
      answerCell: "B6",
      expected: 218,
      requiredFunctions: [],
      forbiddenFunctions: [],
      requireReference: true,
    };
    expect(g("=VLOOKUP(1043,A2:B3,2,FALSE)", lookup).message).toBe(
      "You typed 1043, the value in B5. Point at B5 instead, so the result updates when the data changes.",
    );
    // With no range read, the first cell in reading order is named.
    expect(g("=1043", lookup).message).toContain("the value in A3.");
  });

  it("4. reading its own cell is a circular reference", () => {
    expect(g("=SUM(B2:B6)")).toMatchObject({
      rule: "reference",
      message: "The formula reads B6, the cell it is in. Excel calls this a circular reference.",
      start: 5,
      end: 10,
    });
    expect(g("=SUM(B:B)").rule).toBe("reference");
  });

  it("4. numbers that set how a function works are not data", () => {
    const spec: GradeSpec = {
      rows: [
        ["Code", "Qty"],
        [1, 2],
        [2, 7],
      ],
      answerCell: "C1",
      expected: 7,
      requiredFunctions: ["VLOOKUP"],
      forbiddenFunctions: [],
      requireReference: true,
    };
    expect(g("=VLOOKUP(A3,A2:B3,2,FALSE)", spec)).toMatchObject({ correct: true });
  });

  it("4. a fallback value is the task's choice, not data", () => {
    const spec: GradeSpec = {
      rows: [
        ["Amount", "Days", "Over 30"],
        [1250, 60, null],
        [2400, 0, null],
      ],
      answerCell: "C2",
      expected: 1250,
      requiredFunctions: [],
      forbiddenFunctions: [],
      requireReference: true,
    };
    for (const f of [
      "=SUM(FILTER(A2:A3,B2:B3>30,0))",
      '=IFERROR(SUMIF(B2:B3,">30",A2:A3),0)',
      '=IFNA(SUMIF(B2:B3,">30",A2:A3),0)',
    ])
      expect(g(f, spec), f).toMatchObject({ correct: true });
  });

  it("4. a number compared with a cell is a threshold, not data", () => {
    const scores: GradeSpec = {
      rows: [
        ["Name", "Score", "Spent", "Result"],
        ["Ana", 70, 0, null],
        ["Ben", 0, 4, null],
      ],
      answerCell: "D2",
      expected: "Pass",
      requiredFunctions: [],
      forbiddenFunctions: [],
      requireReference: true,
    };
    expect(g('=IF(B2>=70,"Pass","Fail")', scores)).toMatchObject({ correct: true });
    expect(g('=IF(70<=B2,"Pass","Fail")', scores)).toMatchObject({ correct: true });
    expect(g('=IF(C2=0,"Pass","Fail")', scores)).toMatchObject({ correct: true });
    expect(g('=IF(COUNTIF(B2:B3,">0")=1,"Pass","Fail")', scores)).toMatchObject({
      correct: true,
    });
    // A LET name stands for the cells it was given.
    expect(g('=LET(s,B2,IF(s>=70,"Pass","Fail"))', scores)).toMatchObject({ correct: true });
    // Typed numbers outside a comparison are still data.
    expect(g('=IF(B2+70>=140,"Pass","Fail")', scores).rule).toBe("reference");
    expect(g('=IF(70>=70,"Pass","Fail")', scores).rule).toBe("reference");
  });

  it("4. codes, positions and SWITCH cases are settings, not data", () => {
    const spec = (expected: number | string): GradeSpec => ({
      rows: [
        ["Item", "Value", "Code"],
        ["A", 20, 1],
        ["B", 15, 2],
        ["C", 9, 4],
        ["Out", null, null],
      ],
      answerCell: "B5",
      expected,
      requiredFunctions: [],
      forbiddenFunctions: [],
      requireReference: true,
    });
    expect(g("=SUBTOTAL(4,B2:B4)", spec(20))).toMatchObject({ correct: true });
    expect(g("=AGGREGATE(14,4,B2:B4,2)", spec(15))).toMatchObject({ correct: true });
    expect(g("=LARGE(B2:B4,2)", spec(15))).toMatchObject({ correct: true });
    expect(g("=SMALL(B2:B4,1)", spec(9))).toMatchObject({ correct: true });
    expect(g('=SWITCH(C2,1,"one",2,"two","other")', spec("one"))).toMatchObject({
      correct: true,
    });
    expect(g("=MROUND(B4,4)", spec(8))).toMatchObject({ correct: true });
  });

  it("5. the value comes last", () => {
    expect(g("=SUM(B2:B4)")).toMatchObject({
      rule: "value",
      message: "B6 shows 358, which is not the result this exercise expects.",
      value: 358,
      display: "358",
    });
  });
});

describe("grade: value messages", () => {
  it("explains error values", () => {
    expect(g("=SUM(B2:B5)/0").message).toBe(
      "B6 shows `#DIV/0!`: the formula divides by zero or by an empty cell.",
    );
  });

  it("explains a range where one value belongs", () => {
    expect(g("=SUM(B2:B5)+B2:B3").message).toBe(
      "The formula returns several cells, but B6 holds one value.",
    );
    const spec = { ...sales, requiredFunctions: [], requireReference: false };
    expect(g("=B2:B5", spec).message).toBe(
      "The formula returns several cells, but B6 holds one value.",
    );
  });

  it("names text where a number belongs, and case differences", () => {
    const spec = { ...sales, requiredFunctions: [] };
    expect(g('=SUM(B2:B5)&""', spec).message).toBe(
      'B6 shows the text `"446"`, but this exercise expects a number.',
    );
    const text: GradeSpec = {
      rows: [["west"]],
      answerCell: "B1",
      expected: "West",
      requiredFunctions: [],
      forbiddenFunctions: [],
      requireReference: true,
    };
    expect(g("=A1", text).message).toBe("B1 shows west. Check upper and lower case.");
  });

  it("allows tiny floating-point differences", () => {
    const spec: GradeSpec = {
      rows: [[0.1], [0.2]],
      answerCell: "A3",
      expected: 0.3,
      requiredFunctions: [],
      forbiddenFunctions: [],
      requireReference: true,
    };
    expect(g("=A1+A2", spec).correct).toBe(true);
  });

  it("gives the same verdict for the same formula every time", () => {
    expect(g("=SUM(B2:B4)")).toEqual(g("=SUM(B2:B4)"));
  });
});
