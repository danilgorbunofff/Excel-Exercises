# Pages

Every page type, where it comes from, and what it promises. Screenshots at 375 and 1280 px, light and dark, are in `docs/pages/shots/`. Rebuild them with `node tools/shoot-pages.ts` after `npm run build`.

| Page                    | Address                             | Built from                                                                                                                                        |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                    | `/`                                 | Split hero with a solved sheet, counts, three solid offer blocks, how it works beside a wrong answer, audiences, FAQ, last call.                  |
| Exercises (catalogue)   | `/exercises/`                       | The tracks as ruled rows, one sortable table of every exercise, and a filter panel (text, progress, difficulty, track, function, `?q=`, `?fn=`).  |
| Learning tracks         | `/exercises/tracks/`                | Every topic in `content/track.yaml` as a card with a Not started, In progress or Completed pill.                                                  |
| Learning track          | `/exercises/tracks/{slug}/`         | One topic: progress, Start, Continue or Review, the numbered list. `/topics/{slug}/` redirects here.                                              |
| Exercise                | `/exercises/{slug}/`                | One exercise file. Exercise and Answer tabs, a timer, a draggable divider on wide screens, more exercises.                                        |
| Functions               | `/functions/`                       | `content/function-index.yaml`: task groups with chips, and a table of every function with syntax and exercise count.                              |
| Function                | `/functions/{name}/`                | One file in `content/functions/`: an editable example, syntax, about, exercises, walkthroughs, examples, tips, questions. SUM and VLOOKUP so far. |
| Articles                | `/articles/`, `/articles/{slug}/`   | Markdown in `content/articles/`, shown as cards with a sheet cover. Each ends with exercises and more articles.                                   |
| Search                  | `/search/`                          | `src/lib/search-items.ts`: functions, exercises, tracks, walkthroughs, articles and tool pages. Also served as `/search-index.json`.              |
| Log in, Sign up, PRO    | `/login/`, `/register/`, `/pro/`    | UI only while `siteConfig.accountsOpen` is false: the forms are disabled and say so.                                                              |
| Progress                | `/progress/`                        | This browser's storage: what is next, what is due for review, counts, and clearing.                                                               |
| Privacy, Terms, Contact | `/privacy/`, `/terms/`, `/contact/` | Plain pages. The host and the contact address come from `site.config.ts`.                                                                         |
| Page not found          | any unknown address                 | A search that opens the catalogue filtered, and links to the catalogue and home.                                                                  |

Accounts and PRO have pages but no backend yet. Progress stays in this browser. Exercises with `pro: true` show a PRO badge and stay free to play.

Added in revision 4: `/formula-explainer/` and `/formula-explainer/{slug}/` (from `content/explainers.yaml`), `/excel-shortcuts/` (from `content/shortcuts.yaml`), `/resources/`, `/forgot-password/`, `/reset-password/`, `/verify/`, `/account/`, `/profile/`, `/mock-assessments/` and `/subscribe/`. The account pages are UI only while `siteConfig.accountsOpen` is false. The contact form opens the visitor's email program once `siteConfig.contactEmail` is set.

## Rules that hold on every page

Each one is checked by a test in `tests/e2e/pages.spec.ts`, so a later change cannot break it quietly:

- One order: the catalogue, the numbers, every Next button and the progress page all read `content/track.yaml`.
- The same footer links on every page: Learn and Support columns, Contact included.
- Breadcrumbs never repeat a level and never include the page's own name.
- Every block of structured data parses. Breadcrumbs carry `BreadcrumbList`, and function pages carry `TechArticle`.
- No internal link leads to a missing page.

## Function pages

- **Worked examples are run through the grader** by `src/content/functions.test.ts`, so a page never shows a result its formula would not give.
- **Each page says what it was checked against and when.** Both pages were checked against Microsoft Support on 11 November 2026. The page lists what that check covered and says the examples were not checked in Excel.
- **Content the Microsoft pages do not state** is Excel behaviour the grader also implements:
  - on SUM: numbers stored as text and circular references
  - on VLOOKUP: the cause of `#VALUE!`, since Microsoft's wording there names the wrong argument
- **Related functions without a page are listed by name.** The function index links each one to the exercises that use it.
- **Every function link to exercises uses `/exercises/?fn={NAME}`.** It shows only the exercises whose answer uses that function, matched by exact name.
- **The header example can be edited** on wide screens. Changing a cell or the formula updates the result cell. It reuses the formula explainer in its compact form.
- **About, tips and common questions are required** in each function file by `src/content/schema.ts`. Walkthroughs are listed when their formula calls the function.

## Article pages

- **Each article may set a `cover`** of up to 12 characters, such as `$A$1`. The cover is drawn as one cell on a sheet, with no image file.
- **More articles** lists up to three others, those sharing the most functions first.

## Progress and review

- A solved exercise comes back for review 1, 3, 7, 21 and then 60 days after the last solve.
- Solving it again on a later day moves it to the next gap. Solving it again on the same day does not count.
- An exercise whose answer was shown but not yet solved is not scheduled.
- There is no streak counter and no countdown.

## Owner items on these pages

- **Contact address:** the contact page says it is not set yet until `contactEmail` is set in `site.config.ts`.
- **Host:** the privacy page says the host is not chosen yet until `host` is set, with its name and its privacy notice.
- **Terms:** the terms are short and plain. They say the site is free, carries no warranty and is not made by Microsoft. They have not been reviewed by a lawyer.
