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
const expectedSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.array(cellValue).min(1)).min(1),
]);

/** Grader rules, in the fixed order they are checked. The grader owns the list. */
export const ruleSchema = z.enum(RULES);

export const screenSchema = z
  .object({
    prompt: sentence,
    /** Rows of the grid, starting at A1. null is an empty cell. Every row has the same width. */
    rows: z.array(z.array(cellValue).min(1)).min(1),
    /** The cell the learner writes in. It must be inside the grid and empty. */
    answerCell: cellRef,
    /** One value, or for a formula that spills (FILTER, SORT...), every cell it fills from answerCell. */
    expected: expectedSchema,
    /**
     * The same sheet with some cells changed, and the result then. A formula
     * that is right here but wrong on a variant fails as "fragile".
     */
    variants: z
      .array(z.object({ set: z.record(cellRef, cellValue), expected: expectedSchema }))
      .min(1)
      .optional(),
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
      fragile: sentence.optional(),
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
    // A spilled result fills a block from the answer cell: it must fit the grid and find it empty.
    const blocks = [s.expected, ...(s.variants ?? []).map((v) => v.expected)];
    const taken = new Set<string>();
    blocks.forEach((block, b) => {
      if (!Array.isArray(block) || !at) return;
      const path = b === 0 ? ["expected"] : ["variants", b - 1, "expected"];
      if (block.some((r) => r.length !== block[0]?.length)) {
        ctx.addIssue({
          code: "custom",
          path,
          message: "every row of a spilled result needs the same width",
        });
      }
      block.forEach((r, i) => {
        r.forEach((_, j) => {
          const row = at.row + i;
          const col = at.col + j;
          taken.add(`${col}:${row}`);
          if (row > s.rows.length || col > width) {
            ctx.addIssue({
              code: "custom",
              path,
              message: "the spilled result runs past the grid",
            });
          } else if ((i > 0 || j > 0) && s.rows[row - 1]?.[col - 1] !== null) {
            ctx.addIssue({ code: "custom", path, message: "the spilled result needs empty cells" });
          }
        });
      });
    });
    (s.variants ?? []).forEach((v, i) => {
      for (const address of Object.keys(v.set)) {
        const cell = parseAddress(address);
        if (!cell || cell.row > s.rows.length || cell.col > width) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", i, "set", address],
            message: "is outside the grid",
          });
        } else if (
          (at && cell.row === at.row && cell.col === at.col) ||
          taken.has(`${cell.col}:${cell.row}`)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", i, "set", address],
            message: "is where the answer goes",
          });
        }
      }
    });
    if (s.variants && !s.misses.fragile) {
      ctx.addIssue({
        code: "custom",
        path: ["misses", "fragile"],
        message: "add misses.fragile, shown when a formula fails on a variant",
      });
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

/**
 * A daily-only task, in content/daily/. It appears on /daily/ and nowhere else.
 * tier is its step of the week: 1 for Monday, the easiest, to 7 for Sunday.
 */
export const dailySchema = exerciseSchema.omit({ topic: true, notes: true }).extend({
  tier: z.number().int().min(1).max(7),
});

/**
 * A held-out task for the timed mock assessments, in content/mocks/. It has no
 * page of its own and no required function: the prompt is the whole brief.
 */
export const mockSchema = exerciseSchema.omit({ topic: true, notes: true });

/**
 * A PRO function drill, in content/drills/: one short screen that practises one
 * function, named in the prompt. Drills play one after another on
 * /exercises/drills/ and have no page of their own.
 */
export const drillSchema = mockSchema.extend({
  /** The function the drill practises, as named in content/function-index.yaml. */
  function: z.string().regex(/^[A-Z][A-Z0-9.]*$/u),
  screens: z.array(screenSchema).length(1),
});

/**
 * One step of a track exercise's ladder, in content/steps/: the same theme,
 * easiest (1) to hardest (5). The exercise itself fills the one step no file
 * covers. A step opens at /exercises/<parent slug>/<step>/, shares the parent's
 * free or PRO access, and a solve of any step counts as the exercise solved.
 */
export const stepSchema = mockSchema
  .extend({
    /** The track exercise this step belongs to. */
    parent: kebab,
    step: z.number().int().min(1).max(5),
  })
  .refine((s) => s.id === `${s.parent}-step-${s.step}` && s.slug === s.id, {
    message: "id and slug must be <parent>-step-<step>",
    path: ["id"],
  })
  .superRefine((s, ctx) => {
    // The answer shows at hint 3, which marks the solve as with help; hints 1
    // and 2 must not give it away.
    s.screens.forEach((screen, i) => {
      const answer = screen.answer.slice(1).replaceAll("$", "");
      for (const step of ["nudge", "rule"] as const) {
        if (answer.length > 6 && screen.hints[step].replaceAll("$", "").includes(answer))
          ctx.addIssue({
            code: "custom",
            path: ["screens", i, "hints", step],
            message: "quotes the answer, which only hint 3 may show",
          });
      }
    });
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

/** Article topics, in the order the article index shows its filter. */
export const ARTICLE_TOPICS = {
  lookups: "Lookups",
  sums: "Sums and counts",
  logic: "Logic and errors",
  text: "Text and cleanup",
  dates: "Dates",
  finance: "Finance tasks",
  interviews: "Interviews and tests",
  habits: "Working habits",
} as const;
export type ArticleTopic = keyof typeof ARTICLE_TOPICS;
const articleTopic = z.enum(Object.keys(ARTICLE_TOPICS) as [ArticleTopic, ...ArticleTopic[]]);

/** An article: Markdown with this front matter. */
export const articleSchema = z.object({
  title: sentence,
  description: sentence,
  updated: isoDate,
  /** Reading time in minutes. */
  minutes: z.number().int().min(1),
  /** Which filter on the article index the article falls under. */
  topic: articleTopic,
  /** Functions the article covers, linked as chips. */
  functions: z.array(excelName).default([]),
  /** Exercise ids to practise after reading. */
  exercises: z.array(kebab).default([]),
  /** A few characters of formula text drawn on the article's cover, such as "$A$1". */
  cover: z.string().min(1).max(12).optional(),
});

export type Article = z.infer<typeof articleSchema>;

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
