# Content

How exercises are stored, checked and ordered. The schema lives in `src/content/schema.ts`. The site build and CI both use it.

## Files

- `content/track.yaml` holds the six topics and the single order of exercise ids. Every page that lists, numbers or links exercises reads this list. Nothing else orders exercises.
- `content/exercises/{id}.yaml` holds one exercise. The file name, the `id` and the `slug` are the same. The slug becomes the address `/exercises/{slug}/`.

## One exercise

| Field            | What it holds                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `id`, `slug`     | Lowercase words joined by hyphens. Never change a published slug without a redirect.                |
| `level`          | 1, 2 or 3.                                                                                          |
| `title`          | Shown in lists and as the page heading.                                                             |
| `topic`          | A topic slug from `track.yaml`. The brief calls this a group. The site calls it a topic everywhere. |
| `updated`        | The date the file last changed.                                                                     |
| `checkedInExcel` | The date someone confirmed the expected values in Excel, or `null`. All 24 are `null` today.        |
| `screens`        | One or more screens. Every seed exercise has one.                                                   |
| `notes`          | What the function does, its syntax, a worked example and common errors.                             |

Each screen holds:

| Field                                     | What it holds                                                                                                                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`                                  | The task, in one or two sentences.                                                                                                                                                                                              |
| `rows`                                    | The grid from A1. `null` is an empty cell. Every row has the same number of cells.                                                                                                                                              |
| `answerCell`                              | Where the learner writes. It must be inside the grid and empty.                                                                                                                                                                 |
| `expected`                                | The value the answer cell must show: a number, text, `true` or `false`. For a formula that spills (FILTER, SORT), a list of rows: the block it fills from the answer cell, which must be empty.                                 |
| `answer`                                  | The reference formula. It is shown only at hint step 3, which marks the exercise as solved with help.                                                                                                                           |
| `requiredFunctions`, `forbiddenFunctions` | Upper-case function names the grader knows.                                                                                                                                                                                     |
| `requireReference`                        | When true, typed data values and formulas with no cells are misses. Default true.                                                                                                                                               |
| `hints.nudge`                             | Hint step 1.                                                                                                                                                                                                                    |
| `hints.rule`                              | Hint step 2. The screen adds the comparison of the learner's ranges with the answer's ranges.                                                                                                                                   |
| `misses`                                  | Text shown with the verdict after a miss, one per grader rule: `syntax`, `required-function`, `forbidden-function`, `reference`, `value`. `value` is always needed. The others are needed when a reject fixture uses that rule. |
| `accept`                                  | Formulas that must be graded correct.                                                                                                                                                                                           |
| `reject`                                  | Formulas that must fail, each with the rule it must fail on.                                                                                                                                                                    |

`variants` (optional) is a list of `{ set: { B3: 500 }, expected: ... }`: the same sheet with some cells changed, and the result the formula must give then. A formula that is right on the sheet but wrong on a variant fails as `fragile`, so a screen with variants needs `misses.fragile`. Changed cells must be inside the grid and away from the answer.

## Difficulty

The level is how hard the thinking is, not how long the formula is. A short formula can be advanced when choosing it is the hard part.

| Level          | Prompt                              | Formula                           | Data                          |
| -------------- | ----------------------------------- | --------------------------------- | ----------------------------- |
| 1 Beginner     | Names the function.                 | One function or arithmetic.       | Up to 8 rows, clean.          |
| 2 Intermediate | Names the idea, often the function. | One or two functions.             | Up to 15 rows, clean.         |
| 3 Advanced     | Asks the business question only.    | At least two of the traits below. | 15 to 40 rows where it helps. |

Level-3 traits. Mix them, so advanced tasks do not all feel alike:

- **Tricky single function**: one function used in a way that is not obvious, such as SUMPRODUCT on tests, an approximate match, or wildcards.
- **Composition**: two or more functions, each doing its own job, such as a lookup feeding SUMIFS or INDEX with two MATCHes.
- **Messy data**: numbers stored as text, extra spaces, blanks, error cells, duplicates or mixed case.
- **Robust**: the formula passes `variants`.
- **Multi-step model**: screens that build on each other.
- **Dynamic array**: FILTER, UNIQUE, SORT, SORTBY, TAKE, CHOOSECOLS or LET, with a spilled result.

A level-3 screen has no `requiredFunctions`: the prompt asks the business question, so any formula that Excel finds right on the sheet and its variants passes. The functions an exercise practises come from its reference answer.

At levels 1 and 2, a required function is named in the prompt or the exercise title, so the miss "This exercise asks for X" is true. Daily tasks require none: any formula Excel finds right passes.

`npm run content:validate` enforces the checkable part: a required function is named in the prompt or title, a level-3 screen requires no function, and every level-3 exercise has `variants` or a spilled answer on at least one screen. For ladder steps it also checks that hints 1 and 2 do not quote the answer.

## What the checks enforce

`npm run content:validate` checks:

- every file against the schema
- grid shape and the answer cell
- function names, and miss text for each rejected rule
- unique ids and slugs
- known topics, and every topic having exercises
- every exercise in the order exactly once

`src/content/fixtures.test.ts` runs every reference answer, accepted formula and rejected formula through the grader. It writes every reject verdict, with its miss text, to `src/content/__snapshots__/verdicts.txt`, and checks both against the copy rules. A change to what a learner reads shows up as a diff in that file.

## Ladder steps

Every track exercise is one step of a five-step ladder on the same theme, easiest (1) to hardest (5). The other four steps are files in `content/steps/`, named `<exercise id>-step-<n>.yaml`, with `parent` and `step`. The exercise fills the one step no file covers: by default step 1 for a level-1 exercise, step 3 for level 2 and step 4 for level 3.

- Solving any step counts as solving the exercise, for the track, progress and certificates. Nobody has to solve all five.
- A step opens at `/exercises/<exercise slug>/<step>/`, shares the exercise's track place, Next and free or PRO access, and is left out of search (`noindex`, no sitemap entry).
- When the exercise comes back for review, the progress page opens another step: the first unsolved one above the hardest solved.
- Each step is a distinct task: new data, a new layout or a new twist, not the same sheet with other numbers. The level never drops going up the ladder (`npm run content:validate` checks it), and a level-3 step follows the level-3 rules above.
- A ladder shows only once all four step files exist.

Write a track's steps as a compact spec in `tools/step-specs/<track>.mjs` and run `node tools/new-steps.ts <spec>`: it fills in expected values from the grader and checks every accept and reject. Add `--write` to create the files. Then run the same checks as drills, with `--kind=step`: `npm run content:validate`, `npm run lint:copy`, `node tools/audit-tasks.ts --kind=step` and `node tools/write-audit-fixtures.ts` with Excel open, set `checkedInExcel`, then `npx vitest run src/content -u` and read the new lines in `verdicts.txt`.

## Changing the order

Move lines in the `order` list of `content/track.yaml`. Topics can be reordered the same way. Run `npm run content:validate` afterwards.

## Adding an exercise

1. Copy an exercise file of the same kind and rename it to the new id.
2. Change the grid, the prompt, the answer and the fixtures.
3. Add the id to the order in `content/track.yaml`.
4. Run `npm test`. A new exercise adds new lines to the verdict snapshot. Read them, then accept them with `npx vitest run src/content -u`.

## Not yet checked

Nothing here has been opened in Excel. Every expected value was worked out by hand and agrees with the grader. That is two derivations, not a check against Excel. When an exercise is confirmed in Excel, set `checkedInExcel` to that date.

## Drills

PRO function drills live in `content/drills/`, one file per drill, named
`<function>-drill-<n>.yaml`. Each is a `mocks`-style task (no topic, no notes)
with exactly one screen and a `function` field naming one function from
`content/function-index.yaml`. A drill names its function in the prompt and
lists it in `requiredFunctions`, at any level: drills are about one function,
so the level-3 rule does not apply. Every function in the index has exactly five (the validator checks), easy to hard:

1. the plain call;
2. a different range shape (a row or a block);
3. a criterion or value held in a cell, or a second argument;
4. an edge case: blanks, text, negatives;
5. combined with another function.

They are not in `track.yaml`. `/exercises/drills/` plays them in a row, and
`/api/exercises/<slug>/` gives their answers only to PRO.

Write a batch as a compact spec and run `node tools/new-drills.ts <batch.mjs>`: it fills
in expected values from the grader and checks every accept and reject. Add `--write` to
create the files. Then: `npm run content:validate`, then `node tools/audit-tasks.ts --kind=drill`
and `node tools/write-audit-fixtures.ts` with Excel open, set `checkedInExcel`,
then `npx vitest run src/content -u` and read the new lines in `verdicts.txt`.
