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
| `expected`                                | The value the answer cell must show: a number, text, `true` or `false`.                                                                                                                                                         |
| `answer`                                  | The reference formula. It is shown only at hint step 3, which marks the exercise as solved with help.                                                                                                                           |
| `requiredFunctions`, `forbiddenFunctions` | Upper-case function names the grader knows.                                                                                                                                                                                     |
| `requireReference`                        | When true, typed data values and formulas with no cells are misses. Default true.                                                                                                                                               |
| `hints.nudge`                             | Hint step 1.                                                                                                                                                                                                                    |
| `hints.rule`                              | Hint step 2. The screen adds the comparison of the learner's ranges with the answer's ranges.                                                                                                                                   |
| `misses`                                  | Text shown with the verdict after a miss, one per grader rule: `syntax`, `required-function`, `forbidden-function`, `reference`, `value`. `value` is always needed. The others are needed when a reject fixture uses that rule. |
| `accept`                                  | Formulas that must be graded correct.                                                                                                                                                                                           |
| `reject`                                  | Formulas that must fail, each with the rule it must fail on.                                                                                                                                                                    |

## What the checks enforce

`npm run content:validate` checks:

- every file against the schema
- grid shape and the answer cell
- function names, and miss text for each rejected rule
- unique ids and slugs
- known topics, and every topic having exercises
- every exercise in the order exactly once

`src/content/fixtures.test.ts` runs every reference answer, accepted formula and rejected formula through the grader. It writes every reject verdict, with its miss text, to `src/content/__snapshots__/verdicts.txt`, and checks both against the copy rules. A change to what a learner reads shows up as a diff in that file.

## Changing the order

Move lines in the `order` list of `content/track.yaml`. Topics can be reordered the same way. Run `npm run content:validate` afterwards.

## Adding an exercise

1. Copy an exercise file of the same kind and rename it to the new id.
2. Change the grid, the prompt, the answer and the fixtures.
3. Add the id to the order in `content/track.yaml`.
4. Run `npm test`. A new exercise adds new lines to the verdict snapshot. Read them, then accept them with `npx vitest run src/content -u`.

## Not yet checked

Nothing here has been opened in Excel. Every expected value was worked out by hand and agrees with the grader. That is two derivations, not a check against Excel. When an exercise is confirmed in Excel, set `checkedInExcel` to that date.
