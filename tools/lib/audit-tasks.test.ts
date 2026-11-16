import { describe, expect, it } from "vitest";
import type { Screen } from "../../src/content/schema.ts";
import {
  excelMatches,
  judgeCandidate,
  loadTasks,
  localeSensitive,
  mutants,
  patch,
  restyles,
  rewrites,
  staticIssues,
  strayNumbers,
  type TaskScreen,
} from "./audit-tasks.ts";
import { cacheKey, serialFromLocal } from "./excel-bridge.ts";
import { sameExcel, toExcelShape } from "./excel-compare.ts";

const screen = (over: Partial<Screen> = {}): Screen =>
  ({
    prompt: "In C4, total B2:B3.",
    rows: [
      ["Item", "Cost", null],
      ["Pen", 2, null],
      ["Ink", 5, null],
      [null, null, null],
    ],
    answerCell: "C4",
    expected: 7,
    answer: "=SUM(B2:B3)",
    requiredFunctions: [],
    forbiddenFunctions: [],
    requireReference: true,
    hints: { nudge: "Add the costs.", rule: "SUM adds a range." },
    misses: { value: "The total is 7." },
    accept: ["=B2+B3"],
    reject: [{ formula: "=7", rule: "reference" }],
    ...over,
  }) as Screen;

const task = (s: Screen): TaskScreen => ({
  kind: "exercise",
  id: "t",
  file: "t.yaml",
  level: 1,
  index: 0,
  screen: s,
});

describe("candidate generation", () => {
  it("makes off-by-one, typed and pointer mutants", () => {
    const m = mutants("=SUM(B2:B3)", screen()).map((c) => c.formula);
    expect(m).toEqual(
      expect.arrayContaining([
        "=SUM(B2:B2)",
        "=SUM(B3:B3)",
        "=SUM(B2:B4)",
        "=SUM(C2:C3)",
        "=AVERAGE(B2:B3)",
        "=7",
      ]),
    );
  });
  it("swaps comparison operators inside and outside criteria strings", () => {
    const m = mutants('=COUNTIF(B2:B3,">=5")+(B2>1)', screen()).map((c) => c.formula);
    expect(m).toContain('=COUNTIF(B2:B3,">5")+(B2>1)');
    expect(m).toContain('=COUNTIF(B2:B3,">=5")+(B2>=1)');
  });
  it("drops the -- conversion and a wrapper", () => {
    const m = mutants("=SUMPRODUCT(--TRIM(A2:A3))", screen()).map((c) => c.formula);
    expect(m).toContain("=SUMPRODUCT(TRIM(A2:A3))");
    expect(m).toContain("=SUMPRODUCT(--A2:A3)");
  });
  it("restyles references and case", () => {
    expect(restyles("=SUM(B2:B3)").map((c) => c.formula)).toEqual([
      "=SUM($B$2:$B$3)",
      "=SUM(B$2:B$3)",
      "=sum(b2:b3)",
    ]);
  });
  it("rewrites lookups and conditional sums into other families", () => {
    const r = rewrites('=VLOOKUP(D2,A2:C9,3,FALSE)+SUMIF(A2:A9,">5",C2:C9)').map((c) => c.formula);
    expect(r).toContain('=XLOOKUP(D2,A2:A9,C2:C9)+SUMIF(A2:A9,">5",C2:C9)');
    expect(r).toContain('=INDEX(C2:C9,MATCH(D2,A2:A9,0))+SUMIF(A2:A9,">5",C2:C9)');
    expect(r).toContain("=VLOOKUP(D2,A2:C9,3,FALSE)+SUMPRODUCT((A2:A9>5)*C2:C9)");
  });
});

describe("shape checks", () => {
  it("passes a clean screen", () => {
    expect(staticIssues(screen())).toEqual([]);
  });
  it("finds a filled answer cell, a ragged grid and a variant that changes nothing", () => {
    const s = screen({
      rows: [
        ["a", 1],
        ["b", 2, null],
        [null, null, 3],
      ] as Screen["rows"],
      answerCell: "C3",
      variants: [{ set: { B2: 2 }, expected: 7 }],
    });
    expect(staticIssues(s)).toEqual(
      expect.arrayContaining([
        "grid is not rectangular",
        "answer cell C3 is not empty",
        "variant 1 does not change the expected result",
      ]),
    );
  });
  it("keeps a same-result variant that catches a rejected formula", () => {
    const s = screen({
      variants: [{ set: { B2: 2 }, expected: 7 }],
      reject: [{ formula: "=B2*3+1", rule: "fragile" }],
      misses: { reference: "Point at the cells.", fragile: "Use the cells." },
    } as unknown as Partial<Screen>);
    expect(staticIssues(s)).toEqual(["variant 1 does not change the expected result"]);
    s.variants = [{ set: { B2: 3, B3: 4 }, expected: 7 }];
    expect(staticIssues(s)).toEqual([]);
  });
  it("patches past the edge", () => {
    expect(patch([[1]], { B2: 5 })).toEqual([[1], [null, 5]]);
  });
});

describe("judging against Excel", () => {
  it("matches blocks with blanks as 0 and single values with tolerance", () => {
    expect(excelMatches({ value: [[1], [0]] }, [[1], [null]])).toBe(true);
    expect(excelMatches({ value: 0.30000000000000004 }, 0.3)).toBe(true);
    expect(excelMatches({ value: "north" }, "North")).toBe(false);
    expect(excelMatches({ value: null, invalid: "x" }, 0)).toBe(false);
  });
  it("judges typed results, wrong passes, survivors and unnamed required functions", () => {
    const t = task(screen());
    const run = (
      formula: string,
      value: number,
      source: "mutant" | "accept" | "rewrite" = "mutant",
    ) => judgeCandidate(t, { formula, source, note: "" }, [{ value }]).outcome;
    expect(run("=7", 7)).toBe("ok");
    expect(run("=B2+B3", 9, "accept")).toBe("wrong-passes");
    expect(run("=SUM(B2:B4)", 7)).toBe("survivor");
    const hidden = task(screen({ requiredFunctions: ["SUM"] }));
    expect(
      judgeCandidate(hidden, { formula: "=B2+B3", source: "rewrite", note: "" }, [{ value: 7 }])
        .outcome,
    ).toBe("policy");
    const named = task(
      screen({ requiredFunctions: ["SUM"], prompt: "In C4, total B2:B3 with SUM." }),
    );
    expect(
      judgeCandidate(named, { formula: "=B2+B3", source: "rewrite", note: "" }, [{ value: 7 }])
        .outcome,
    ).toBe("ok");
    const titled = { ...hidden, title: "SUM: total the sales" };
    expect(
      judgeCandidate(titled, { formula: "=B2+B3", source: "rewrite", note: "" }, [{ value: 7 }])
        .outcome,
    ).toBe("ok");
  });
  it("marks text numbers, TEXT and decimal criteria as needing an en-US check", () => {
    expect(localeSensitive(task(screen()), "=SUM(B2:B3)")).toBe(false);
    expect(localeSensitive(task(screen()), '=COUNTIF(B2:B3,"<0.3")')).toBe(true);
    expect(localeSensitive(task(screen()), '=COUNTIF(B2:B3,">3")')).toBe(false);
    expect(localeSensitive(task(screen()), '=TEXT(B2,"0.0")')).toBe(true);
    const typed = screen({
      rows: [
        ["Item", "Cost", null],
        ["Pen", "1,050", null],
        ["Ink", 5, null],
        [null, null, null],
      ],
    });
    expect(localeSensitive(task(typed), "=SUM(--B2:B3)")).toBe(true);
  });
  it("flags numbers in feedback that the data does not hold", () => {
    expect(strayNumbers("The total is 7, not 70. Row 3 of B2:B3.", task(screen()))).toEqual(["70"]);
  });
});

describe("Excel bridge helpers", () => {
  it("turns a local date into a serial", () => {
    expect(serialFromLocal(new Date(2024, 1, 29))).toBe(45351);
  });
  it("keys a case by sheet, formula and cell", () => {
    const a = cacheKey({ rows: [[1]], formula: "=A1", cell: "B1" });
    expect(a).not.toBe(cacheKey({ rows: [[1]], formula: "=A1", cell: "C1" }));
  });
  it("compares grader values with Excel's shape", () => {
    expect(toExcelShape({ kind: "error", code: "#N/A" })).toEqual({ error: "#N/A" });
    expect(sameExcel(toExcelShape({ kind: "range", rows: [[1, null]] } as never), [[1, 0]])).toBe(
      true,
    );
  });
});

describe("content", () => {
  it("loads every screen", () => {
    expect(loadTasks().length).toBeGreaterThan(300);
  });
});
