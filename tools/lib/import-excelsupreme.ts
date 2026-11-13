// Why this exists: brings the owner's exercises from the earlier excelsupreme
// project into this site's format. Every accepted and rejected formula is run
// through this site's grader, so a fixture only survives if it holds here.
// The hint ladder and the worked example have no source field, so they are
// left empty for a person to write; validation fails until they are.
import { grade, knownFunctions, type Rule } from "@practice/grader";

type Cell = string | number | boolean | null;

export interface SourceScreen {
  type: string;
  prompt: string;
  grid?: { startCell: string; rows: Cell[][] };
  answerCell?: string;
  expect?: { value: string | number | boolean };
  reference?: string;
  require?: { id: string; func: string; minArgs?: number }[];
  forbid?: { id: string; func: string }[];
  hints?: Record<string, string>;
  fixtures?: { accept: string[]; reject: { formula: string; rule: string; why?: string }[] };
}

export interface SourceExercise {
  id: string;
  slug: string;
  level: number;
  title: string;
  screens: SourceScreen[];
  docs?: {
    syntax?: string;
    explain?: string;
    errors?: { code: string; text: string }[];
    reference?: string;
  };
}

export interface Screen {
  prompt: string;
  rows: Cell[][];
  answerCell: string;
  expected: string | number | boolean;
  answer: string;
  requiredFunctions: string[];
  forbiddenFunctions: string[];
  hints: { nudge: string; rule: string };
  misses: Partial<Record<Rule, string>> & { value: string };
  accept: string[];
  reject: { formula: string; rule: Rule }[];
}

export interface Exercise {
  id: string;
  slug: string;
  level: number;
  title: string;
  topic: string;
  updated: string;
  checkedInExcel: null;
  screens: Screen[];
  notes: { summary: string; syntax: string; example: string; commonErrors: string[] };
}

const CRITERIA = /^(SUMIFS?|COUNTIFS?|AVERAGEIFS?)$/u;

/** Where an excelsupreme group lands in this site's track, or null to leave it out. */
export function topicFor(group: string, functions: readonly string[]): string | null {
  const criteria = functions.some((f) => CRITERIA.test(f));
  switch (group) {
    case "sum":
      return criteria ? "conditions" : "totals";
    case "count":
      return criteria ? "conditions" : "counting";
    case "statistical":
      return functions.every((f) => ["AVERAGE", "MIN", "MAX"].includes(f))
        ? "totals"
        : "statistics";
    case "logical":
      return "logic";
    case "rounding":
      return "rounding";
    case "lookup":
      return "lookups";
    case "index-match":
      return "index-match";
    case "text-search":
      return "text-search";
    case "text-change":
      return "text-change";
    case "errors":
      return "errors";
    case "date":
      return "dates";
    case "aggregate":
      return "subtotals";
    case "modeling":
      return "models";
    case "capstone":
      return "capstone";
    default:
      return null;
  }
}

const KNOWN = new Set(knownFunctions());
const unique = <T>(xs: T[]) => [...new Set(xs)];

/** The first one or two sentences of the first paragraph. */
function opening(text = ""): string {
  const first = text.split(/\n\s*\n/u)[0] ?? "";
  const sentences = first.match(/[^.?]+[.?]+(?=\s|$)/gu) ?? [first];
  return sentences
    .slice(0, 2)
    .map((s) => s.trim())
    .join(" ");
}

function convertScreen(
  s: SourceScreen,
  docsReference: string | undefined,
  notes: string[],
  where: string,
): Screen | null {
  if (s.type !== "formula") {
    notes.push(`${where}: dropped a ${s.type} screen`);
    return null;
  }
  if (!s.grid || !s.answerCell || !s.expect) {
    notes.push(`${where}: dropped a formula screen with no grid or answer`);
    return null;
  }
  if (s.grid.startCell !== "A1") {
    notes.push(`${where}: dropped a screen whose grid starts at ${s.grid.startCell}`);
    return null;
  }
  const hints = s.hints ?? {};
  const required = unique((s.require ?? []).map((r) => r.func.toUpperCase()));
  const forbidden = unique((s.forbid ?? []).map((r) => r.func.toUpperCase()));
  const spec = {
    rows: s.grid.rows,
    answerCell: s.answerCell,
    expected: s.expect.value,
    requiredFunctions: required,
    forbiddenFunctions: forbidden,
    requireReference: true,
  };
  const passes = (f: string) => grade(f, spec).correct;

  const misses: Screen["misses"] = { value: hints["value"] ?? hints["error"] ?? "" };
  if (hints["syntax"]) misses.syntax = hints["syntax"];
  const funcHint = (s.require ?? []).map((r) => hints[r.id]).find(Boolean);
  if (funcHint) misses["required-function"] = funcHint;
  const forbidHint = (s.forbid ?? []).map((r) => hints[r.id]).find(Boolean);
  if (forbidHint) misses["forbidden-function"] = forbidHint;
  const refHint = Object.entries(hints).find(([k]) => k.startsWith("require-ref"))?.[1];
  if (refHint) misses.reference = refHint;

  const accept: string[] = [];
  for (const f of s.fixtures?.accept ?? []) {
    if (passes(f)) accept.push(f);
    else notes.push(`${where}: dropped accept ${f}`);
  }
  const answer = [s.reference, docsReference, ...accept].find((f): f is string =>
    Boolean(f && passes(f)),
  );
  if (!answer) {
    notes.push(`${where}: no reference answer passes this grader`);
    return null;
  }

  const reject: Screen["reject"] = [];
  for (const r of s.fixtures?.reject ?? []) {
    const verdict = grade(r.formula, spec);
    if (verdict.correct) {
      notes.push(
        `${where}: dropped reject ${r.formula} (${r.rule}, ${r.why ?? ""}), it passes here`,
      );
      continue;
    }
    const rule = verdict.rule as Rule;
    if (!misses[rule]) {
      notes.push(`${where}: dropped reject ${r.formula}, no message for ${rule}`);
      continue;
    }
    if (!reject.some((x) => x.formula === r.formula)) reject.push({ formula: r.formula, rule });
  }

  return {
    prompt: s.prompt,
    rows: s.grid.rows,
    answerCell: s.answerCell,
    expected: s.expect.value,
    answer,
    requiredFunctions: required,
    forbiddenFunctions: forbidden,
    hints: { nudge: "", rule: "" },
    misses,
    accept,
    reject,
  };
}

/** Converts one exercise. Returns null, with the reason in notes, when it cannot come over. */
export function convert(
  src: SourceExercise,
  topic: string,
  today: string,
): { exercise: Exercise | null; notes: string[] } {
  const notes: string[] = [];
  const unknown = unique(
    src.screens
      .filter((s) => s.type === "formula")
      .flatMap((s) => [...(s.require ?? []), ...(s.forbid ?? [])].map((r) => r.func.toUpperCase()))
      .filter((f) => !KNOWN.has(f)),
  );
  if (unknown.length) {
    notes.push(`${src.id}: skipped, the grader does not know ${unknown.join(", ")}`);
    return { exercise: null, notes };
  }
  const screens = src.screens
    .map((s, i) =>
      convertScreen(s, i === 0 ? src.docs?.reference : undefined, notes, `${src.id} #${i + 1}`),
    )
    .filter((s): s is Screen => s !== null);
  if (!screens.length) {
    notes.push(`${src.id}: skipped, no formula screen came over`);
    return { exercise: null, notes };
  }
  return {
    exercise: {
      id: src.slug,
      slug: src.slug,
      level: src.level,
      title: src.title,
      topic,
      updated: today,
      checkedInExcel: null,
      screens,
      notes: {
        summary: opening(src.docs?.explain),
        syntax: (src.docs?.syntax ?? "").replace(/^=/u, ""),
        example: "",
        commonErrors: (src.docs?.errors ?? []).map((e) => e.text),
      },
    },
    notes,
  };
}
