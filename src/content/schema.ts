// Why this exists: the shape of exercise and track files. The site build and
// the CI validator share it, so content cannot pass one and fail the other.
import { knownFunctions, parseAddress, RULES } from "@practice/grader";
import { z } from "astro/zod";

const kebab = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use lowercase words joined by hyphens");
const cellRef = z.string().regex(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/, "use a cell address such as B6");
const KNOWN = new Set(knownFunctions());
const functionName = z
  .string()
  .regex(/^[A-Z][A-Z0-9.]*$/, "use an upper-case function name")
  .refine((name) => KNOWN.has(name), "the grader does not know this function");
/** Any Excel function name, including ones the grader does not run. */
const excelName = z.string().regex(/^[A-Z][A-Z0-9.]*$/, "use an upper-case function name");
// YAML readers differ: some turn 2026-11-10 into a Date, some keep a string.
// Both become the same ISO string here, so the site and CI agree.
const isoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use a date such as 2026-11-10"),
);
const cellValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const sentence = z.string().min(1);

/** Grader rules, in the fixed order they are checked. The grader owns the list. */
export const ruleSchema = z.enum(RULES);

export const screenSchema = z
  .object({
    prompt: sentence,
    /** Rows of the grid, starting at A1. null is an empty cell. Every row has the same width. */
    rows: z.array(z.array(cellValue).min(1)).min(1),
    /** The cell the learner writes in. It must be inside the grid and empty. */
    answerCell: cellRef,
    expected: z.union([z.string(), z.number(), z.boolean()]),
    /** The reference answer, shown at hint step 3, which marks the exercise "solved with help". */
    answer: z.string().startsWith("="),
    requiredFunctions: z.array(functionName).default([]),
    forbiddenFunctions: z.array(functionName).default([]),
    requireReference: z.boolean().default(true),
    /**
     * The hint ladder, shown on request. Step 1 is the nudge. Step 2 is the
     * rule, shown with the comparison of the learner's ranges and the answer's.
     * Step 3 is the reference answer.
     */
    hints: z.object({ nudge: sentence, rule: sentence }),
    /** Text shown with the verdict after a miss, one per grader rule. */
    misses: z.object({
      syntax: sentence.optional(),
      "required-function": sentence.optional(),
      "forbidden-function": sentence.optional(),
      reference: sentence.optional(),
      value: sentence,
    }),
    accept: z.array(z.string().startsWith("=")).min(1),
    reject: z.array(z.object({ formula: z.string(), rule: ruleSchema })).min(1),
  })
  .superRefine((s, ctx) => {
    const width = s.rows[0]?.length ?? 0;
    s.rows.forEach((row, i) => {
      if (row.length !== width) {
        ctx.addIssue({
          code: "custom",
          path: ["rows", i],
          message: `every row needs ${width} cells, like the first row`,
        });
      }
    });
    const at = parseAddress(s.answerCell);
    if (at && (at.row > s.rows.length || at.col > width)) {
      ctx.addIssue({ code: "custom", path: ["answerCell"], message: "is outside the grid" });
    } else if (at && s.rows[at.row - 1]?.[at.col - 1] !== null) {
      ctx.addIssue({ code: "custom", path: ["answerCell"], message: "must be an empty cell" });
    }
    for (const name of s.requiredFunctions) {
      if (s.forbiddenFunctions.includes(name)) {
        ctx.addIssue({
          code: "custom",
          path: ["forbiddenFunctions"],
          message: `${name} is both required and forbidden`,
        });
      }
    }
    s.reject.forEach(({ rule }, i) => {
      if (!s.misses[rule]) {
        ctx.addIssue({
          code: "custom",
          path: ["reject", i, "rule"],
          message: `add misses.${rule}, the text shown after this kind of miss`,
        });
      }
    });
  });

export const exerciseSchema = z.object({
  id: kebab,
  slug: kebab,
  level: z.number().int().min(1).max(3),
  title: sentence,
  topic: kebab,
  /** A PRO exercise: built without its answers and locked until the visitor has PRO (isLocked). */
  pro: z.boolean().default(false),
  updated: isoDate,
  /** The date the expected values were last checked in Excel, or null if not yet. */
  checkedInExcel: isoDate.nullable(),
  screens: z.array(screenSchema).min(1),
  notes: z.object({
    summary: sentence,
    /** Function syntax. Code, so the copy linter skips it. */
    syntax: sentence,
    example: sentence,
    commonErrors: z.array(sentence).min(1),
  }),
});

export const trackSchema = z.object({
  topics: z
    .array(
      z.object({
        slug: kebab,
        title: sentence,
        summary: sentence,
        /** Where the track sits on the tracks page: the essentials, one skill, or interview practice. */
        group: z.enum(["essentials", "skill", "interview"]).default("skill"),
        /** The slug of a related mock assessment set, linked from the track page. */
        assessment: kebab.optional(),
        /** What you will learn, one line each, shown as a checklist on the track page. */
        learn: z.array(sentence).default([]),
      }),
    )
    .min(1),
  /** The one order of exercise ids used everywhere on the site. */
  order: z.array(kebab).min(1),
});

export type Exercise = z.infer<typeof exerciseSchema>;
export type Screen = z.infer<typeof screenSchema>;
export type Track = z.infer<typeof trackSchema>;

/** Mock assessments: fixed sets of existing exercise screens, taken against the clock. */
export const assessmentsSchema = z.object({
  sets: z
    .array(
      z.object({
        slug: kebab,
        title: sentence,
        summary: sentence,
        /** The time limit. */
        minutes: z.number().int().min(1).max(180),
        /** Free for everyone. Every other set needs PRO. */
        sample: z.boolean().default(false),
        /** An exercise id (its first screen), or an id and a 0-based screen. */
        tasks: z
          .array(
            z.union([
              kebab.transform((exercise) => ({ exercise, screen: 0 })),
              z.object({ exercise: kebab, screen: z.number().int().min(0) }),
            ]),
          )
          .min(1)
          .max(30),
      }),
    )
    .min(1),
});

export type Assessments = z.infer<typeof assessmentsSchema>;
export type AssessmentSet = Assessments["sets"][number];

/** A function reference page. Worked examples are run through the grader in a test. */
export const functionSchema = z.object({
  name: functionName,
  slug: kebab,
  summary: sentence,
  /** Code, so the copy linter skips it. */
  syntax: sentence,
  arguments: z
    .array(z.object({ name: z.string().min(1), required: z.boolean(), description: sentence }))
    .min(1),
  returns: sentence,
  examples: z
    .array(
      z.object({
        title: sentence,
        rows: z.array(z.array(cellValue).min(1)).min(1),
        /** The cell the formula sits in. It must be inside the grid and empty. */
        cell: cellRef,
        formula: z.string().startsWith("="),
        result: z.union([z.string(), z.number(), z.boolean()]),
        explanation: sentence,
      }),
    )
    .min(1),
  pitfalls: z.array(z.object({ title: sentence, text: sentence })).min(1),
  /** When to reach for the function and how it behaves, one paragraph each. */
  about: z.array(sentence).min(1),
  /** Short habits that save time or prevent a mistake. */
  tips: z.array(sentence).min(1),
  /** What people ask about the function, each with a short answer. */
  questions: z.array(z.object({ q: sentence, a: sentence })).min(1),
  alternatives: z.array(z.object({ name: excelName, text: sentence })),
  related: z.array(excelName),
  versions: sentence,
  /** What the page was checked against, when, and what that covered. */
  checked: z.object({
    source: sentence,
    url: z.url(),
    date: isoDate,
    covers: sentence,
  }),
  /** The id of the exercise the page ends with. */
  exercise: kebab,
  updated: isoDate,
});

export type FunctionPage = z.infer<typeof functionSchema>;

/** The function cards on the Functions page, grouped by task. */
export const functionIndexSchema = z
  .object({
    groups: z.array(z.object({ slug: kebab, title: sentence, summary: sentence })).min(1),
    functions: z
      .array(
        z.object({
          name: excelName,
          group: kebab,
          /** Microsoft's category for the function, for the "All functions" list. */
          category: sentence.default("Other"),
          summary: sentence,
          /** Code, so the copy linter skips it. */
          syntax: z.string().startsWith("="),
        }),
      )
      .min(1),
  })
  .superRefine((idx, ctx) => {
    const groups = new Set(idx.groups.map((g) => g.slug));
    idx.functions.forEach((f, i) => {
      if (!groups.has(f.group)) {
        ctx.addIssue({ code: "custom", path: ["functions", i, "group"], message: "unknown group" });
      }
    });
  });

export type FunctionIndex = z.infer<typeof functionIndexSchema>;

/** An article: Markdown with this front matter. */
export const articleSchema = z.object({
  title: sentence,
  description: sentence,
  updated: isoDate,
  /** Reading time in minutes. */
  minutes: z.number().int().min(1),
  /** Functions the article covers, linked as chips. */
  functions: z.array(excelName).default([]),
  /** Exercise ids to practise after reading. */
  exercises: z.array(kebab).default([]),
  /** A few characters of formula text drawn on the article's cover, such as "$A$1". */
  cover: z.string().min(1).max(12).optional(),
});

export type Article = z.infer<typeof articleSchema>;

/** Formula walkthroughs for the formula explainer. */
export const explainersSchema = z.object({
  walkthroughs: z
    .array(
      z.object({
        slug: kebab,
        title: sentence,
        description: sentence,
        /** Code, so the copy linter skips it. */
        formula: z.string().startsWith("="),
        rows: z.array(z.array(cellValue).min(1)).min(1),
        how: z.array(sentence).min(1),
        mistakes: z.array(z.object({ q: sentence, a: sentence })).default([]),
        /** The exercise id to practise with. */
        exercise: kebab,
      }),
    )
    .min(1),
});

export type Explainers = z.infer<typeof explainersSchema>;
export type Walkthrough = Explainers["walkthroughs"][number];

/** Keyboard shortcuts, grouped, for Windows and Mac. Keys are code. */
export const shortcutsSchema = z.object({
  groups: z
    .array(
      z.object({
        title: sentence,
        items: z
          .array(z.object({ action: sentence, win: z.string().min(1), mac: z.string().min(1) }))
          .min(1),
      }),
    )
    .min(1),
});
