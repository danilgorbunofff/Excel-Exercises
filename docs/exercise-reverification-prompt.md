# Prompt: full reverification of exercises, grading and task logic

You are a senior developer and an Excel expert auditing the Excel Exercises site (Astro + TypeScript, repo root `excelexercises/`). Your job is to prove that every task on the site works and is graded correctly: a learner who writes any correct formula passes, a learner who writes a wrong one fails with a true and helpful message, and every surface (tracks, interview tracks, daily, mock assessments, certificates) picks, locks, grades and stores tasks exactly as designed. Assume nothing. Verify by running code, not by reading it.

## What exists

- **Grader**: `packages/grader/` (tokenize, parse, evaluate, grade). One answer cell, or a spilled block for dynamic-array answers. Rules in fixed order: `syntax`, `required-function`, `forbidden-function`, `reference`, `value`, `fragile`. `variants` re-run a passing formula on changed data and fail it as `fragile` if it was tied to the visible numbers.
- **Content**:
  - `content/exercises/*.yaml`: 118 track exercises, ordered by `content/track.yaml` (topics, including 4 interview tracks).
  - `content/daily/*.yaml`: 56 daily-only tasks with `tier` 1 (Monday, easiest) to 7 (Sunday, hardest).
  - `content/mocks/*.yaml`: 30 held-out tasks for the 3 PRO timed sets in `content/assessments.yaml`. The free `sample` set uses track exercises.
- **Schemas and rules**: `src/content/schema.ts` (screen, exercise, daily, mock), `tools/lib/validate-content.ts` (level-3 rubric, pools, tiers), `src/lib/assessments.ts` (`checkAssessments`, `skillsOf`, `gradeAttempt`), `docs/content.md` (field meanings and the Difficulty rubric).
- **Access**: `src/lib/access.ts` (`isLocked`: first `siteConfig.freePerTrack` exercises of each track are free, the rest PRO), `src/pages/api/exercises/[slug].ts` (answers for PRO users only, including mock tasks).
- **Daily**: `src/lib/daily.ts` (`pickFor` ladder from `LADDER_START`, `legacyPickFor` for older solves, `cleanDailySolves`), `src/scripts/daily.ts`, `src/scripts/daily-view.ts`, `src/pages/api/daily.ts`.
- **Mocks and certificates**: `src/pages/mock-assessments/[slug].astro`, `src/scripts/assessment.ts`, `src/scripts/assessment-score.ts`, `src/server/assessment-specs.ts`, `src/lib/certificates.ts`, `src/pages/api/assessments*`.
- **Workbench**: `src/scripts/exercise.ts`, `src/scripts/view.ts`, `src/components/Sheet.astro` (spill painting, verdict labels, hint ladder).
- **Tests**: `npm run test` (Vitest, including `src/content/fixtures.test.ts`, which runs every accept/reject fixture and keeps a reviewed verdict snapshot), `npm run content:validate`, `npm run e2e` (Playwright, three engines), `npm run check:all`.

## Ground rules

1. Start from a clean baseline: run `npm run check:all` (or each step of it) and record every failure that exists before you change anything, with its cause. Do not fix unrelated failures silently; list them separately.
2. Never weaken a test, delete a fixture, or change an `expected` value to make a check pass. An `expected` value changes only when you have shown it is wrong, and the evidence goes in the report.
3. Every fix ships with proof: a new accept or reject fixture, a unit test, or an e2e assertion that fails before the fix and passes after.
4. Treat Microsoft 365 Excel (current channel, en-US locale, comma separators) as the ground truth. When you cannot run Excel, say so and mark the item "needs an Excel check" instead of guessing. Set `checkedInExcel` only for screens truly confirmed in Excel.
5. Keep the house copy rules (`tools/lib/copy-lint.ts`): no dashes, no exclamation marks, straight quotes, sentences under 30 words. Run `npm run lint:copy` after any content change.
6. Do not touch unrelated uncommitted work (for example `content/articles/`). Do not commit, push or deploy unless the owner says so.

## Phase 1: the grader against Excel

For every function in `packages/grader/src/functions/` and every operator in `evaluate.ts`, build a table of cases with the Excel result and check the grader gives the same value or error. Cover at least:

- **Type coercion**: text numbers (`"12"`, `"1,050"`, `"5%"`), blanks, booleans in arithmetic, in comparisons and in aggregates. Check that SUM skips text in ranges but errors on typed text, and how `--` and `*1` behave on ranges.
- **Comparison order**: numbers < text < logicals, case-insensitive text, a blank compared with text and with numbers.
- **Errors**: propagation through every function, `IFERROR` and `IFNA` scope, `#N/A` versus `#VALUE!` versus `#REF!` versus `#CALC!` versus `#SPILL!`, and division by a blank.
- **Criteria functions** (COUNTIF(S), SUMIF(S), AVERAGEIF(S)): operators inside strings, `"<="&cell`, wildcards `*` `?` `~`, criteria on numbers stored as text, a blank criteria cell, and ranges of different sizes.
- **Lookups**: exact and approximate match, sorted and unsorted data, VLOOKUP column out of range, XLOOKUP `if_not_found`, `match_mode` and `search_mode`, MATCH types 1, 0 and -1, INDEX with row or column 0, a number against a text-number.
- **Rounding**: ROUND, ROUNDUP, ROUNDDOWN, MROUND, FLOOR, CEILING with negatives and binary float edges (2.675, 1.005), and displayed precision through `formatNumber`.
- **Dates**: serial numbers, DATEDIF units, EOMONTH, EDATE, WEEKDAY, TODAY under a fixed clock.
- **Text**: LEFT, MID, FIND, SEARCH, SUBSTITUTE, TEXTBEFORE and TEXTAFTER (instance numbers, not found), TRIM on inner spaces, TEXTJOIN ignore-empty.
- **Arrays and spill**: element-wise operators, broadcasting a row against a column, mismatched sizes (`#N/A` padding), array IF, `SUM(IF(...))`, and SUMPRODUCT with boolean arrays. Check FILTER (no match, `if_empty`, column filter), UNIQUE (`by_col`, `exactly_once`, case), SORT and SORTBY (multi-key, descending, blanks last), TAKE and CHOOSECOLS with negatives, SEQUENCE, ROWS, COLUMNS. Check LET scoping, a name reused, a name that looks like a cell, and spill blocked by data (`#SPILL!`).
- **Functions Excel 365 lifts over arrays that the grader may not** (LEN, TRIM, VALUE or LEFT on a range, COUNTIF with an array criteria, MATCH with an array lookup). List each gap. For each gap, either implement it or make sure no task's correct alternative depends on it.
- **Parser**: `$` anchors, whole-column refs, spaces, unicode minus, `=+`, leading `@`, sheet names rejected, unknown names, argument counts, a missing closing bracket, and a semicolon separator message.

Where possible, generate the ground truth automatically: write each case to an `.xlsx`, recalculate it in Excel (or LibreOffice headless as a first pass, noting known LibreOffice differences), read the values back and diff them against the grader. Add every confirmed case to the grader tests.

## Phase 2: every task, screen by screen

Run this for all 118 track exercises, 56 daily tasks and 30 mock tasks. Script whatever you can, and read every screen yourself as well.

For each screen, check:

1. **The brief.** The prompt is unambiguous: one reading, one correct result. It names the answer cell. It states rounding, units, inclusive or exclusive bounds ("more than" versus "at least"), case rules and what counts as a match. A level-3 prompt asks the business question and does not name the function. Daily and mock prompts make sense without a track's context.
2. **The data.** The grid is rectangular, the answer cell is empty and inside it, and any spill block fits the grid and is empty. Traps in the data (text numbers, trailing spaces, duplicates, mixed case, blanks) are intended and mentioned in hints. No accidental trap changes the answer.
3. **The expected value.** Recompute it by hand or in Excel. Check its type (the number 3 versus the text "03"), its precision and its sign. For spills, check the order of rows and that blanks show as 0.
4. **The reference answer** passes, is idiomatic and would be accepted by a reviewer in an interview.
5. **Correct formulas that must pass.** For each screen, write at least five genuinely different correct formulas:
   - a different function family (SUMIFS for SUMIF, XLOOKUP for INDEX/MATCH, IFS for nested IF, SUMPRODUCT or array maths for a conditional sum);
   - absolute and mixed references;
   - lower case and extra spaces;
   - a different but equivalent order of operations;
   - a FILTER or LET version where it fits.

   Run each through `grade()` with the screen's spec, variants included. Any correct formula that fails is a bug: a grader gap, a too-strict `requiredFunctions` or `forbiddenFunctions`, a `requireReference` false positive (the typed-number heuristic in `typedDataNumber` flagging a legitimate constant such as 0.05, 12, 100 or 1.1), or a variant that only the reference answer survives. Fix the cause, then add the formula to `accept`.
6. **Wrong formulas that must fail.** Write the common mistakes:
   - a range off by one row;
   - the wrong column index;
   - relative versus absolute errors;
   - `>` for `>=`;
   - FALSE for TRUE in a lookup;
   - the result typed in, or a reference to the cell that happens to hold it;
   - the wrong criteria;
   - skipping the text-number conversion;
   - sorting before filtering;
   - the right formula on the wrong row.

   Each must fail, on the rule a learner would expect. A wrong formula that passes is the most serious finding: add data or a variant that separates it, then add it to `reject`.
7. **Variants.** Each changed cell is realistic, changes the expected result, and every formula in `accept` and your list of correct formulas still passes. Formulas tied to positions or to the visible numbers fail as `fragile`. Every level-3 exercise has variants or a spilled answer, and screens whose result can depend on data have variants wherever possible.
8. **Feedback.**
   - Every `misses` text is factually true for this data, and every number in it matches the computed result.
   - Every rule used by a `reject` has miss text, and `fragile` exists when variants exist.
   - Hints step 1 and step 2 lead toward a correct approach without giving the answer, and never advise something that would fail.
   - The verdict wording in `src/content/__snapshots__` reads correctly for every reject.
9. **Level and placement.**
   - The level matches the rubric in `docs/content.md`.
   - Track order is by prerequisite: no exercise needs a function taught later in the track.
   - Each daily task's tier fits its weekday and difficulty never falls from Monday to Sunday.
   - Each mock task suits its set.

Write a script (keep it under `tools/`, with a test) that prints, per screen, the result of steps 3 to 7. Store your formula lists as fixtures so the audit can be rerun.

## Phase 3: logic around the tasks

- **Free and PRO.**
  - The first two exercises of every track are free and all others are PRO. Interview tracks follow the same rule.
  - Search the built `dist/` HTML for the reference answer of every PRO exercise and every mock task: none may appear before the user is entitled to it.
  - `/api/exercises/[slug]` returns answers only for free exercises, or to a PRO user for PRO exercises and mock tasks. Test it signed out, signed in without PRO, and with PRO.
- **Daily.**
  - Each of the 7 steps has tasks.
  - `pickFor` returns the right tier for every weekday across year, leap-day and daylight-saving edges in several time zones, and no task repeats inside a step's cycle.
  - Days before `LADDER_START` use `legacyPickFor`, and solves saved under either pick stay valid in `cleanDailySolves`.
  - The week strip shows Monday to Sunday, with future days not playable and past days practice only.
  - The streak counts only on-day solves, and the server rejects solves that are not the day's pick.
  - Daily tasks never appear in the catalogue, search, sitemap, related links or track pages.
- **Mock assessments.**
  - Timed sets use only held-out tasks, each in exactly one set, and every mock task is used.
  - The browser score and the server regrade (`gradeAttempt` with `loadSpecs`) agree for the same formulas, variants included.
  - The time limit, a reload mid-attempt, blanks and the review page all behave correctly. The answers in the review are fetched only after Finish.
  - The per-skill breakdown (`skillsOf`) names sensible functions.
  - The cover of a timed set shows task titles, not functions.
  - Certificate eligibility (timed, passed, not the sample) holds, and old attempts and certificates still render.
- **Progress.** Solved, helped and revealed states are recorded for track exercises. Daily and mock ids in local progress do not inflate any count. Sign-in merge and export behave correctly.

## Phase 4: in the browser

- Build the site and run the full e2e suite on Chromium, Firefox and WebKit.
- For at least one exercise of each kind, solve it in the real workbench: a single cell, a multi-screen exercise, a spilled answer, a `fragile` miss, a locked PRO exercise, a daily task and a mock attempt end to end.
- Check that the grid outlines what the formula read, that spilled cells paint and clear on reset, that verdict labels match the rule, that the hint ladder works and that "solved with help" is recorded.
- Run axe in light and dark mode on these pages and check mobile width (375 px).

## Report

Write `docs/reverification-report.md` with:

1. **Baseline**: commands run and failures found before any change.
2. **Findings**: a table with one row per issue, giving severity, file and screen, what is wrong, evidence (formula, expected, actual, Excel result) and the fix.
   - **Critical**: a wrong answer passes, or a correct one fails.
   - **High**: misleading feedback or leaked answers.
   - **Medium**: unclear brief, wrong level or order.
   - **Low**: copy and polish.
3. **Grader gaps** versus Excel, each with the decision made.
4. **Excel checks**: screens confirmed in Excel, and screens still needing a check.
5. **Final state**: all checks green (or the remaining pre-existing failures with their causes), the counts of screens and formulas exercised, and the new tests and fixtures added.

You are done only when every screen passes the step 5 and step 6 checks with your formula lists, every finding is fixed with proof or explicitly deferred with a reason, and `npm run test`, `npm run content:validate`, `npm run lint:copy`, `npm run build` and the e2e suite pass apart from documented pre-existing failures.
