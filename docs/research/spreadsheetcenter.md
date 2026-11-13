# Spreadsheet Center: a full study

Recorded 10 November 2026 on spreadsheetcenter.com, the reference the owner chose. Everything here is observed unless marked otherwise.

| Evidence                                                                                           | Where                                                        |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Page-type inspection script and data                                                               | `docs/research/spreadsheetcenter/inspect.ts`, `inspect.json` |
| Exercise flow script and data                                                                      | `docs/research/spreadsheetcenter/flow.ts`, `flow.json`       |
| Screenshots: every page type at 1280 and 375 px, viewport and full page, plus every exercise state | `docs/research/spreadsheetcenter/shots/`                     |
| Earlier scripted wrong answers                                                                     | `docs/research/feedback.json`                                |

Two caveats:

- Each page was visited once, with a desktop and a phone profile.
- I created no account, so signed-in features (sync, mock assessments) are described from the signed-out side only.

## 1. Summary

**What it gets right, and why it feels good:**

- **The exercise screen is a real workbench.** Instructions sit on the left. A spreadsheet with a name box and formula bar sits on the right, under a green "Exercise" bar with Reset. A divider between them can be dragged or moved with the arrow keys.
- **Calm, consistent styling.** One typeface (Inter) and one brand colour (Excel green, `#21A366`). Neutral greys, 4 px corners, small type for meta information, and very little decoration inside the work area.
- **Many routes into the same practice:**
  - a catalogue table with filters
  - nine tracks with numbered exercise lists
  - 502 function pages, each with a live grid
  - a formula explainer that unfolds nested formulas step by step
- **Correct work is shown on the grid.** The answer cell turns green.
- **Completion leaves a bar under the grid:** "Completed!" with a "Next exercise" button.
- **No third-party requests.** Analytics run through a first-party subdomain.

**What it gets wrong:**

- **The grader checks only the value.** Typed numbers in place of cell references pass, with a message praising the use of SUM. A wrong range gets no message at all. (Observed in Phase 1 and again here.)
- **The grid is a `<canvas>` from a large spreadsheet library.** It costs about 1.5 MB of script on a cold load. On a phone it starts 1,260 px down the page and draws about 2.8 s after being scrolled into view.
- **Accessibility:**
  - On the exercise page, keyboard focus starts inside the spreadsheet's hidden editor, and Tab never leaves it.
  - Opening the completion dialog left focus on a plain `<div>`, not inside the dialog.
  - axe reports critical issues on every page that has a grid.
  - The brand green fails text contrast.
- **No dark mode, and no skip link.**
- **The catalogue lists exercises alphabetically,** while tracks use their own order.

## 2. Site map

The sitemap (`/sitemap-index.xml`) lists 733 URLs:

| Section                            | URLs | Page type                                                                                                                      |
| ---------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/excel-functions/<name>/`         | 502  | Function reference with a live grid                                                                                            |
| `/excel-exercises/<slug>/`         | 165  | Exercise. The catalogue shows 159 rows, 12 of them marked PRO.                                                                 |
| `/excel-articles/<slug>/`          | 22   | Article                                                                                                                        |
| `/excel-formula-explainer/<slug>/` | 10   | Formula walkthrough                                                                                                            |
| `/excel-exercises/tracks/<slug>/`  | 9    | Track: a numbered list of exercises                                                                                            |
| Index pages                        | 6    | Exercises, tracks, functions, articles, explainer, shortcuts                                                                   |
| Account and legal                  | 15   | Log in, register, profile, account, assessment history, privacy, terms, disclosure, contact, subscribe, resources, search, 404 |

**Header (desktop).** Logo, a 448 px search field, then Exercises, Functions and Articles as visible links, then "Log in" and a green "Sign up" button. The header is 65 px tall, white, with a 1 px shadow.

**Header (phone).** Logo and a menu button ("Open main menu", `aria-expanded`). It opens an in-page panel with Start here, Exercises, Functions, Articles, Search, Log in and Sign up. It is not a `<dialog>`.

**Footer.** Near-black `#1E1E1E`, a short description, then two columns:

- Learn: Exercises, Functions, Articles, Formula explainer
- Support: Terms of service, Privacy policy, Affiliate disclosure, Contact us

## 3. Technology

| Part           | What it is                                                                                                                                                                                                                                                                                           | How I know                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Framework      | Astro 5.16, static pages with interactive islands                                                                                                                                                                                                                                                    | `<meta name="generator">`, `astro-island` elements                                 |
| Styling        | Tailwind CSS v4: default oklch palette, utility class names                                                                                                                                                                                                                                          | Computed colours match Tailwind v4 defaults. Class names such as `py-20 lg:py-24`. |
| Spreadsheet    | Univer (Apache-2.0), drawn on `<canvas>`                                                                                                                                                                                                                                                             | `--univer-*` CSS variables, three canvases per grid                                |
| Islands seen   | `SpreadsheetContainer`, `ExerciseTimer`, `ResizableDivider`, `SignupBanner`, `InlineAuthForms`, `ExercisesTable`, `ExerciseFiltersPanel`, `ExercisesOverviewStreakCard`, `TrackMonument`, `TrackCompleteBurst`, `FormulaExplainer`, `FunctionSearch`, `HeaderSearch`, `AuthNav`, `ProWaitlistPrompt` | `component-url` attributes                                                         |
| Consent notice | The cookieconsent library                                                                                                                                                                                                                                                                            | `--cc-*` CSS variables                                                             |
| Analytics      | First party, at `stats.spreadsheetcenter.com`                                                                                                                                                                                                                                                        | The only host besides the site itself                                              |
| Fonts          | Inter 400, 500, 600, 700, and 400 italic, self-hosted and preloaded                                                                                                                                                                                                                                  | `document.fonts`, `<link rel=preload>`                                             |

## 4. Visual language

### 4.1 Layout

- The page background is `#F9FAFB` (Tailwind gray-50). Content panels are white.
- The content width is 1280 px (`max-w` 1280). Reading columns are 768 and 896 px. Forms are 448 px wide.
- The exercise page fills the viewport below the header, in two panes:
  - Instructions on the left, at 40% of the width. The width is saved as `exercise-panel-width`.
  - The grid on the right, inset on a pale green panel (`oklch(0.962 0.044 156.7)`).
- On a phone the panes stack: instructions first, then the grid.

### 4.2 Type

All text is Inter, with system fonts as fallback. Formulas and syntax blocks use `ui-monospace`.

| Use                                   | Size / line height  | Weight     | Letter spacing | Colour               |
| ------------------------------------- | ------------------- | ---------- | -------------- | -------------------- |
| Home headline                         | 60 / 72             | 700        | -1.5 px        | `#1E1E1E`            |
| Section heading (home)                | 36 / 43.2           | 700        | -0.9 px        | `#1E1E1E`            |
| Page headline (catalogue, function)   | 36 / 40             | 700        | 0              | gray-900 `#101828`   |
| Exercise title                        | 32 / 41.6           | 700        | +0.32 px       | `#1E1E1E`            |
| Section heading (function page)       | 24 / 32             | 600        | 0              | gray-900             |
| Panel heading ("What you need to do") | 20 / 32             | 600        | 0              | gray-900             |
| Lead paragraph                        | 20 / 32.5           | 400        | 0              | gray-600 `#4A5565`   |
| Body                                  | 16 / 24 and 16 / 28 | 400        | 0              | gray-700 `#364153`   |
| UI text, table rows                   | 14 / 20             | 400 to 600 | 0              | gray-900 or gray-500 |
| Meta, badges, chips                   | 12 / 16             | 500        | 0              | varies               |
| Column labels ("ARGUMENT")            | 12 / 16, upper case | 500        | +0.6 px        | gray-500             |

The measured frequency on the pages is 14 px, then 12 px, then 16 px. The interface is mostly small type with a few large headings.

### 4.3 Colour

| Role              | Value                                                                                                 | Where                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Brand green       | `#21A366`                                                                                             | Primary buttons, the grid header bar, links, chips' text, the completion bar |
| Ink               | `#1E1E1E`                                                                                             | Main headings, the footer background                                         |
| Text greys        | gray-900 `#101828`, gray-700 `#364153`, gray-600 `#4A5565`, gray-500 `#6A7282`, gray-400 `#99A1AF`    | From headings down to the faintest meta text                                 |
| Page background   | `#F9FAFB`                                                                                             | Everywhere                                                                   |
| Lines             | gray-200 `oklch(0.928 0.006 264.5)`                                                                   | 1 px card and table borders                                                  |
| Active tab        | `#0063B1`                                                                                             | The selected "Exercise" or "Answer" tab, with an underline                   |
| Difficulty badges | Beginner `#016630` on `#DBFCE7`; Intermediate `#894B00` on `#FEF9C2`; Advanced `#9F0712` on `#FFE2E2` | Catalogue and exercise titles                                                |
| Function chips    | `#1447E6` on `#DBEAFE`                                                                                | Track and function lists                                                     |
| Grid states       | Answer cell `#E3F2FD` (pale blue). Correct answer `#C8E6C9` (pale green).                             | Inside the canvas                                                            |
| Sign-up banner    | Green-to-blue gradient                                                                                | Shown after completing an exercise when signed out                           |

**Measured contrast** (WCAG 2, computed from the rendered colours):

| Pair                                                                  | Ratio        | Result                               |
| --------------------------------------------------------------------- | ------------ | ------------------------------------ |
| White text on `#21A366` (Sign up, Start buttons, the grid header bar) | 3.23         | Fails 4.5                            |
| `#21A366` text on white (links, "Reset")                              | 3.23         | Fails 4.5                            |
| `#21A366` text on `#F9FAFB`                                           | 3.09         | Fails 4.5                            |
| gray-400 text on white                                                | 2.60         | Fails 4.5                            |
| gray-500 text on white / on `#F9FAFB`                                 | 4.84 / 4.63  | Passes                               |
| Active tab `#0063B1` on white                                         | 6.14         | Passes                               |
| All three difficulty badges                                           | 6.37 to 6.85 | Passes                               |
| Answer-cell tint against a white cell                                 | 1.14         | Too faint to mark a state on its own |
| Correct-cell tint against a white cell                                | 1.34         | Too faint to mark a state on its own |

A darker shade of the same green, `#18804F`, reaches 4.95 on white and 4.74 on `#F9FAFB`. It keeps the look and passes.

### 4.4 Shape, depth and spacing

- **Corners.** 4 px on most elements: buttons, inputs, chips, grid panels. 8 px on primary buttons and cards, 6 px on the search field, 12 px on large cards. Full pills (9999 px) on badges and the "No sign-up required" note.
- **Shadows.** Mostly none. The header has a 1 px shadow, and the completion dialog a large soft one.
- **Spacing.** A 4 px base. The common gaps are 8, 12, 16, 24 and 32 px. Buttons pad 10 by 24 px; primary call-to-action buttons 12 by 32 px, giving a height of 56 px.
- **Motion.** 150 to 200 ms colour transitions on links and buttons, and a fade-in for overlays. I did not check whether they respect `prefers-reduced-motion`.

### 4.5 Components

| Component         | Description                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary button    | Green fill, white 14 to 18 px semibold label, 8 px corners. Arrow icon on "Start track".                                                                                                                                                                                                                                                                                                                          |
| Secondary button  | White fill, 2 px green border, green label ("Explore exercises").                                                                                                                                                                                                                                                                                                                                                 |
| Small button      | White, green 12 px label with an icon ("Reset", "Show Answer"), 4 px corners, on the green grid bar.                                                                                                                                                                                                                                                                                                              |
| Grid panel        | A green header bar holding the title ("Exercise", "Answer", "Spreadsheet editor", "Example data") and Reset on the right. Below it, the name box, the ✕ ✓ ƒx controls, the formula bar, then the grid.                                                                                                                                                                                                            |
| Tabs              | "Exercise" and "Answer", with a blue underline on the selected tab. A real `tablist`.                                                                                                                                                                                                                                                                                                                             |
| Timer chip        | A clock icon, `00:00:00` and an eye icon to hide it. A stopwatch, with a 30-minute countdown option. Stopped by default.                                                                                                                                                                                                                                                                                          |
| Hints             | `<details>` rows: "Hint 1", "Hint 2", "Related function(s)" (function chips) and "More exercises" (links). Each opens with a green chevron.                                                                                                                                                                                                                                                                       |
| Difficulty badge  | Pill, 12 px, green, amber or red.                                                                                                                                                                                                                                                                                                                                                                                 |
| Catalogue table   | Columns Complete, Title and Difficulty, sortable. Each title has category tags and sometimes a blue "Data Analysis" tag or a PRO mark.                                                                                                                                                                                                                                                                            |
| Filter panel      | Two native `<select>` elements: Progress (All, Completed, Not completed) and Difficulty.                                                                                                                                                                                                                                                                                                                          |
| Track card        | Icon tile, name, "22 exercises · 3 hr 40 min", and a thin progress bar.                                                                                                                                                                                                                                                                                                                                           |
| Track page        | Breadcrumbs, icon and title, badge, time and count, "What you'll learn" with check marks, function chips, "Start track", then a numbered exercise list: number, title, badge, one-line description, function chip, Start. The first item is marked "Up next", with a "0 of 22 completed" bar.                                                                                                                     |
| Function page     | Breadcrumbs. Name, one-line purpose, category, and "Excel: all versions, Google Sheets: supported" on the left; a live "Spreadsheet editor" grid on the right. Below: a syntax block with a "Returns: Number" tag, an arguments table, About, Exercises using the function, live Examples, Watch out for, Tips and notes, Common questions and Related functions. A sticky "On this page" list sits on the right. |
| Formula explainer | A formula input with syntax colouring (references blue, strings purple), "Explain formula", and the result in a green box ("2 rows x 3 columns"). Below, an "Inside the formula" tree: each nested part, its intermediate result and a one-line explanation, next to an "Example data" grid.                                                                                                                      |
| Completion dialog | Green header with "Exercise completed" and ✕. A sentence about what was practised and why it matters, then a large green "Next recommended exercise →" button naming the next exercise. `role="dialog"`, `aria-modal`, labelled.                                                                                                                                                                                  |
| Completion bar    | After the dialog closes, a green bar under the grid: "✓ Completed!" on the left, a white "Next exercise →" button on the right.                                                                                                                                                                                                                                                                                   |
| Sign-up banner    | A full-width green-to-blue gradient strip: "Create an account to save your progress", Sign up and ✕.                                                                                                                                                                                                                                                                                                              |

## 5. Page by page

Screenshot names below refer to `docs/research/spreadsheetcenter/shots/`.

- **Home** (`home-1280.jpg`, `home-1280-full.jpg`). The headline "Learn Excel by doing" sits beside a live exercise grid with Show Answer and Reset. Under the headline are two buttons, then a strip of four numbers ("150+ interactive exercises", "209,000+ exercise completions", "500+ functions documented", "100% no download required"). The sections that follow are: Everything you need to practice Excel; How it works (three steps); What makes it different; Who it's for; Common questions; Give it a go.
- **Exercises** (`exercises-1280.jpg`). A centred headline with a green pill ("Practice in your browser. No Excel install. No sign-up required."). Then four track cards, the sortable table of 159 exercises, and on the right a sticky "Learn Excel by doing" card and the filters. The phone version is 23,780 px long.
- **Tracks** (`tracks-1280.jpg`). Nine tracks in three groups: start with the essentials; master a skill; prepare for interviews. The interview group covers data analyst, investment banking, FP&A and accounting.
- **Track** (`track-1280.jpg`). Described in the component table. It is the clearest single-order view on the site.
- **Exercise** (`flow-01-initial.jpg`, `exercise-basic-375-full.jpg`). See section 6.
- **Functions index.** Six task groups (add up, look up, decide, count, clean text, dates), then the essential functions and a searchable function list. The page is 42,698 px long on desktop and 66.7 kB of HTML.
- **Function page** (`function-sumif-1280.jpg`). Described above. JSON-LD: BreadcrumbList and FAQPage.
- **Formula explainer** (`explainer-1280.jpg`). The most distinctive tool on the site: it shows how a formula is evaluated, part by part, next to the data.
- **Articles.** A list of 22 articles with images (4.9 MB of images on a cold load). The article I opened ends with "Ready to practice?".
- **Shortcuts.** A table of shortcuts for Windows and Mac (230+, per its description).
- **Mock assessments.** Redirects to log in.
- **Subscribe.** "Subscriptions are coming soon."
- **404.** "Page not found", returned with a real 404 status.

## 6. The exercise flow, state by state

Recorded on "Basic SUM" (`flow.json`, `flow-*.jpg`).

| Step                                     | What happens                                                                                                                                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load                                     | Instructions on the left, the grid on the right. The answer cell B9 is tinted pale blue. The timer shows `00:00:00` and does not run until started.                                                                                            |
| Hints                                    | Two hints, revealed one at a time. Hint 1 says where the answer goes and which cells hold the numbers. Hint 2 names SUM and explains a range, and mentions click-and-drag to select it. Then related functions as chips, and "More exercises". |
| Answer tab                               | Shows a second, read-only grid with the solution filled in: B9 = 117350, shaded green (`flow-03-answer-tab.jpg`). It has no text explanation.                                                                                                  |
| Wrong answer (`=SUM(B2:B6)`)             | B9 shows 94850. **No message appears**, and nothing new is added to the page.                                                                                                                                                                  |
| Typed numbers (six values added by hand) | Accepted. The dialog says "Nice work! You calculated a total with SUM." (Phase 1, `feedback.json`)                                                                                                                                             |
| Correct answer                           | B9 turns green and the "Exercise completed" dialog opens over the grid. Focus stays on a `<div>`, not in the dialog. No live region announces anything.                                                                                        |
| Escape                                   | Closes the dialog. The green "Completed!" bar with "Next exercise" appears under the grid (`flow-06-after-close.jpg`).                                                                                                                         |
| Reload                                   | The dialog comes back over the grid and blocks Reset. The gradient sign-up banner appears at the top (`flow-07-after-reload.jpg`).                                                                                                             |
| Draft                                    | The workbook is saved in `localStorage` as you type, with a 30-day expiry. The timer state is kept for 1 day.                                                                                                                                  |
| Phone                                    | Instructions and hints fill the first 1,260 px. The grid loads only when scrolled into view and is drawn about 2.8 s later (`flow-11-phone-grid-scrolled.jpg`).                                                                                |

**Keyboard.** On the exercise page, the first Tab press already landed in an off-screen `<div>` belonging to the spreadsheet's editor, and the next 44 presses stayed there (`flow.json`, `tabStops`). From the keyboard alone there is no route back to the instructions, the hints or the header.

On the other page types, the first focusable elements are the logo, the search field, the nav links, Log in and Sign up. No page has a skip link.

## 7. Progress, accounts and storage

| Key                                                   | Contents                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `ssc-progress-storage`                                | Completed exercises with timestamps, tracks, a resume point and an owner id. Version 2. |
| `ssc-spreadsheet-draft:<slug>:exercise` and `:answer` | The whole workbook as JSON, with a 30-day expiry. Function examples use `:example`.     |
| `ssc-timer`                                           | Timer mode and state, with a 1-day expiry                                               |
| `exercise-panel-width`                                | The divider position, as a percentage                                                   |
| `ssc-pro-waitlist`                                    | The visitor's country code, for the PRO waiting list                                    |

- No cookies were set while signed out.
- An account adds sync across devices ("Sign in to sync across devices").
- Paid plans are announced but not open ("Subscriptions are coming soon"). PRO items are marked in the catalogue, and mock assessments need an account.

## 8. Performance

| Page                  | HTML (gzip) | Script, cold         | Load, cold                          |
| --------------------- | ----------- | -------------------- | ----------------------------------- |
| Home (first visit)    | 12.4 kB     | 1,533 kB in 42 files | 566 ms on a fast desktop connection |
| Exercise (warm cache) | 11.5 kB     | 18 kB new            | 185 ms                              |
| Functions index       | 66.7 kB     | 121 kB               | 494 ms                              |
| Articles index        | 10.1 kB     | small                | 4.9 MB of images                    |

- The cost is Univer: about 1.5 MB of script the first time any grid is shown. After that it is cached.
- On the Phase 1 slow-phone profile, the home-page grid drew at 10.9 s. The exercise-page grid had not drawn after 45 s, because it waits to be scrolled into view (`docs/research/measurements.json`).
- The HTML itself is small and fast, around 10 to 13 kB.

## 9. Accessibility (axe, WCAG 2.2 A and AA, desktop)

| Finding                                               | Pages                                                                                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical: `aria-allowed-attr`, `button-name`, `label` | Every page with a grid (home, exercises, function pages, explainer). They come from the spreadsheet's controls.                                             |
| Serious: `scrollable-region-focusable`                | Pages with a grid                                                                                                                                           |
| Serious: `color-contrast`                             | Every page: 1 to 43 instances, mostly the green on white and gray-400                                                                                       |
| Serious: `target-size` (156)                          | The catalogue table's controls                                                                                                                              |
| Serious: `list`                                       | Almost every page                                                                                                                                           |
| Keyboard trap                                         | The exercise page (section 6)                                                                                                                               |
| Duplicate headings                                    | The exercise page has the title as both `h1` and `h2`, and repeats "Need some help?" and "Answer", because the phone and desktop panels are both in the DOM |
| Canvas grid                                           | No cells, rows or headers exposed to assistive technology                                                                                                   |

**What it does well:** the Exercise and Answer tabs are a real `tablist`. The hints use `<details>`. The panel divider is a labelled button that works with the arrow keys. The completion dialog has `role="dialog"`, `aria-modal` and a label.

## 10. SEO

- Every page has a unique title, a description and a canonical URL. Sign-in, register, search and subscribe are `noindex`.
- Titles follow one pattern per type:
  - "Excel SUMIF Function: Syntax, Examples & Practice"
  - "Excel SUM Exercise: Basic SUM"
  - "Beginner essentials in Excel: 22 Practice Exercises (Free)"
- JSON-LD:
  - BreadcrumbList on most pages
  - ItemList on the indexes and tracks
  - FAQPage on the home, catalogue, function and explainer pages
- The 502 function pages each link to the exercises that use the function, and the exercises link back through "Related function(s)". This cross-linking is the site's main search strategy.

## 11. Where it conflicts with our brief

You chose this look, but parts of it are on the brief's ban list or break its non-negotiables. Each needs your decision before Phase 5:

| Spreadsheet Center does                                             | Our brief says                                  | Suggested resolution                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Headline on the left, live grid on the right (home, function pages) | No split hero                                   | Keep the grid as the first thing on the page, but stack it: one line of text above, the exercise below |
| Usage numbers strip: "150+", "209,000+", "500+", "100%"             | No stat strips, nothing fabricated              | Leave it out. The catalogue can say how many exercises exist, derived from the content.                |
| "How it works" in three steps                                       | Banned                                          | Leave it out. The exercise on the page shows how it works.                                             |
| Two buttons under the headline                                      | No centred hero with two buttons                | One action: the exercise itself                                                                        |
| Tracks as cards with icons                                          | Cards and icons only where they are not lists   | A plain list or table of topics, with counts                                                           |
| A stopwatch on every exercise                                       | No countdowns. Short sittings.                  | Leave it out                                                                                           |
| Streak card, track-completion burst                                 | No streaks, no celebrations                     | Leave them out                                                                                         |
| Gradient sign-up banner                                             | No gradients, no sign-up pressure               | Leave it out                                                                                           |
| Alphabetical catalogue beside ordered tracks                        | One order everywhere                            | The catalogue follows the single track order                                                           |
| Value-only grading, silence on a wrong answer                       | The grader explains every miss                  | Our grader (Phase 3)                                                                                   |
| Canvas grid, 1.5 MB, keyboard trap                                  | Server-rendered `<table>`, a JS budget of 70 kB | Our `<table>` grid and formula bar                                                                     |
| Green `#21A366` under white text                                    | 4.5:1 for text                                  | `#18804F` for anything under or used as text. `#21A366` only where no text sits on it.                 |

## 12. What to take from it

**Layout and components to adopt:**

1. **The two-pane exercise screen on desktop:**
   - Instructions on the left: title, difficulty badge, task, a short "What you need to do" list, hints in `<details>`.
   - The grid on the right, under a green bar with the title and Reset.
   - A divider that can be dragged or moved with the arrow keys.
2. **Name box, ✕ ✓ ƒx and the formula bar** above the grid, exactly as Excel shows them.
3. **The answer cell tinted before the attempt and green after it.** We add an outline and words, so the state does not rely on a faint tint.
4. **The completion bar under the grid** ("Completed!" and "Next exercise"), in place of a dialog. It matches the brief's rule that Check turns into Next.
5. **Exercise and Answer tabs.** For us the Answer tab becomes hint step 3 and is marked "solved with help".
6. **The function page structure:**
   - name and purpose
   - version support
   - a live grid
   - a syntax block with its return type
   - an arguments table
   - examples
   - "Watch out for"
   - questions
   - related functions
   - an "On this page" list

   It already matches the brief's reference-page requirements.
7. **The track page:** a numbered list with "Up next", a count and progress, one line per exercise and a function chip. It is the right model for our single order.
8. **The formula explainer idea** (evaluate a formula part by part, next to the data) for later. It is the same parse tree our grader builds.

**Design tokens to adopt:**

- Inter at 400, 500, 600 and 700.
- The gray scale from gray-900 `#101828` down to gray-500 `#6A7282`, with no gray-400 for text.
- A `#F9FAFB` page and white panels.
- 1 px gray-200 lines.
- 4 px corners, and 8 px on large buttons.
- The 14 / 12 / 16 px working sizes.
- Green as the one brand colour, darkened to `#18804F` for text and text backgrounds.
- The blue `#0063B1` for the selected tab, which already passes.

**What to do better, in the same look:**

- A server-rendered `<table>` grid that is there at first paint.
- On a phone, the grid and formula bar come first, the instructions collapse to one line, and the hints sit under the verdict.
- A verdict on every miss that names the rule and the cell and outlines what the formula read.
- A skip link to the formula bar, and normal Tab order through the page.
- A dark theme.
- No timer, streaks or banners.
