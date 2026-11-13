# Phase 2: three directions

Recorded 10 November 2026. Open `docs/directions/index.html` to see every mock and screenshot on one page.

## What exists

Each direction has the same three pages, so the comparison is about design and not content:

- the home page
- an exercise with a wrong answer
- the same exercise with a correct answer

The mocks are static HTML and CSS, each state in its own file. They have no grader and no script. The header menu uses `<dialog>` with invoker commands, which needs no script either.

| Path                                        | What it is                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `docs/directions/tokens.ts`                 | Colour tokens and type for all three directions, light and dark                                    |
| `docs/directions/build.ts`                  | Writes the shared HTML and each direction's `tokens.css`                                           |
| `docs/directions/base.css`                  | Structure shared by all three                                                                      |
| `docs/directions/<direction>/direction.css` | The look of one direction                                                                          |
| `docs/directions/contrast-report.ts`        | Measures every token pair and writes `contrast.md`. Fails under 4.5:1 for text or 3:1 for UI parts |
| `docs/directions/shoot.ts`                  | Screenshots, axe, the phone-screen fit check and the 320 px check. Writes `checks.json`            |
| `docs/directions/shots/`                    | 36 screenshots: 3 directions, 3 pages, 375 and 1280 px, light and dark                             |
| `docs/directions/fonts/`                    | The self-hosted WOFF2 files, each with its OFL licence                                             |

To rebuild everything, run these in order:

```bash
node docs/directions/build.ts
```

```bash
node docs/directions/contrast-report.ts
```

```bash
node docs/directions/shoot.ts
```

```bash
node docs/directions/gallery.ts
```

## Checks that apply to all three

| Check                                                                       | Result                                                                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Contrast: 24 token pairs per theme, 144 measurements in all (`contrast.md`) | All meet their minimum. The closest is Instrument's input border in light: 3.48:1 against 3:1. |
| axe (WCAG 2.0 to 2.2 A and AA rules), 9 pages in light and dark at 375 px   | No serious or critical findings on any of the 18 runs                                          |
| Copy linter on all 9 pages                                                  | Passes                                                                                         |
| Task, input, grid and verdict on one 375 by 812 screen                      | Yes on all 6 exercise pages. Measured bottoms are below.                                       |
| Sideways scroll at 320 px                                                   | None on any of the 9 pages                                                                     |
| Third-party requests                                                        | None. Fonts are local files.                                                                   |
| Motion                                                                      | None in the mocks                                                                              |

The shared grid is a `<table>` with `<caption>` and `<th scope>` headers.

- The name box shows the answer cell.
- The formula input is labelled "Formula for B6".
- The verdict is in a `role="status"` region.
- A skip link goes straight to the formula input.

The wrong state follows Phase 0 decision 9: the verdict names the failed rule and the cell, and the grid outlines what the learner's own formula read. The comparison with the reference answer is left for hint step 2.

How far down a 375 by 812 screen each part ends, in CSS px:

| Direction  | State   | Task | Input | Verdict | Grid |
| ---------- | ------- | ---- | ----- | ------- | ---- |
| Ledger     | wrong   | 249  | 359   | 514     | 785  |
| Ledger     | correct | 249  | 359   | 459     | 730  |
| Instrument | wrong   | 246  | 358   | 499     | 793  |
| Instrument | correct | 246  | 358   | 446     | 740  |
| Marker     | wrong   | 212  | 636   | 807     | 551  |
| Marker     | correct | 212  | 636   | 754     | 551  |

812 px is the brief's test size. A real phone browser with its toolbars showing has less room, often 650 to 750 px. In Ledger and Instrument the verdict comes right after the input, at about 500 px, so it stays visible on a shorter screen and only the bottom of the grid falls off. In Marker the verdict is last, at 807 px, so it is the first thing a shorter screen loses.

## A. Ledger

**Concept.** A worked sheet in a good reference book.

- One reading column of serif text.
- The grid is set into the page like a printed table: ruled lines, row numbers in the margin, a double rule above the total.
- Ink on warm paper.

**Why it suits this audience.** Many visitors arrive from search to read about one function. Ledger makes the reference pages and the exercise feel like one calm document, which suits short sittings and adults who distrust anything that looks like a game.

**Interaction.** Task, then the formula bar (name box, input and Check as one ruled strip), then the verdict as plain sentences, then the grid. Desktop keeps the same single column.

**Type.**

- Text and headings in Source Serif 4: 18 px body; headings 32 px on phones and 40 px from 768 px, weight 600, no italics.
- Cells, references and formulas in IBM Plex Mono.
- Font files: Source Serif 4 at 20.1 and 21.5 kB, Plex Mono at 14.7 and 15.6 kB (weights 400 and 600, Latin).

**Colour.** Warm paper `#fbf9f4` with ink `#1d1b16`, and dark paper `#16150f` with `#ede8dc`.

- **Read by your formula:** ochre, `#8a5a00` light and `#e6b450` dark.
- **Wrong:** vermilion, `#a8231b` and `#ff9a8f`.
- **Correct:** green, `#1d6b3a` and `#7fd39b`.
- The primary button is ink, not one of the state colours.

**Weaknesses.**

- The grid has no vertical rules, so it looks less like Excel. That may weaken the transfer to the real program.
- The tightest phone fit of the three for the grid: 785 of 812 px.

## B. Instrument

**Concept.** A quiet instrument.

- The formula bar is the main control.
- The grid is a readout beside it, drawn with Excel's gridlines and grey row and column headers.
- Everything else steps back.
- Square corners (2 px) and hairlines.

**Why it suits this audience.**

- It looks most like what the learner will meet at work, so what they practise here should carry over to Excel.
- The verdict sits directly under the input on every screen size.
- On desktop the task, input and verdict sit in one column and the grid in the other, so nothing scrolls at 1280 by 800.
- Test-preppers get a tool that stays out of the way.

**Interaction.** Phone: task, formula bar, verdict, grid. Desktop: a container query puts the grid beside the controls once the exercise is 44 rem wide. The landing page keeps the headline above the exercise, so it is not a split hero.

**Type.**

- Text in IBM Plex Sans: 16 px body, 28 px headings, weight 600.
- Formulas in IBM Plex Mono at 20 px in the formula bar.
- Font files: Plex Sans at 22.6 and 24.3 kB, Plex Mono at 14.7 and 15.6 kB. This is the heaviest set, about 77 kB before subsetting.

**Colour.** Cool grey `#f3f4f5` with near-black `#15181c`, and dark `#0f1214` with `#e6e9ec`.

- **Read by your formula:** violet, `#4b48c9` light and `#a9a7ff` dark.
- **Wrong:** red, `#b3261e` and `#ff9089`.
- **Correct:** green, `#176b37` and `#6fd394`.
- The primary button is near-black or near-white.
- There is no blue accent. Links stay the text colour, underlined.

**Weaknesses.**

- It is the closest of the three to a generic tool look. It relies on Plex, the square corners and the violet to avoid that.
- It has the heaviest fonts.

## C. Marker

**Concept.** A printed exercise sheet marked up with a highlighter.

- Large type and heavy 2 px rules.
- Cells the formula read are filled with highlighter yellow and outlined.
- The answer cell is filled pink or green.
- The formula line sits under the sheet, like an answer line, with the verdict below it in a filled box.

**Why it suits this audience.**

- It is the most legible of the three. Atkinson Hyperlegible was designed for low-vision readers.
- The error is the most visible on the data, even at a glance on a small phone.
- Putting the input under the grid puts it just above the phone keyboard.

**Interaction.** Task, grid, formula line, verdict. The verdict box has a full border and a tinted fill, not a left-border callout.

**Type.**

- Text in Atkinson Hyperlegible Next: 19 px body, 28 px headings.
- Cells and formulas in Atkinson Hyperlegible Mono.
- Font files: 12.1 and 12.7 kB for Next, 10.1 and 10.0 kB for Mono. This is the lightest set, about 45 kB.

**Colour.** White and near-black `#111111`, and dark `#121212` with `#f4f4f4`.

- **Read by your formula:** yellow fill `#ffe36e` with a `#6b5300` outline; dark `#4d3f00` with `#ffe36e`.
- **Wrong:** pink fill `#ffc7d3` with `#9c1030`; dark `#55142a` with `#ff9db2`.
- **Correct:** green fill `#b6eec6` with `#0b5a2a`; dark `#123f22` with `#86e3a3`.
- Every fill also has an outline at 3:1 or more, because a fill alone is not enough contrast against white.

**Weaknesses.**

- The verdict comes last on the phone. It is the first thing lost on a shorter screen, and the tightest fit of the three at 807 of 812 px.
- The heavy look can read as a school worksheet. Some adults at work may find that condescending.

## Ban-list check

| Banned pattern                                           | Ledger                                                              | Instrument                                                               | Marker                               |
| -------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------ |
| Split hero, or centred hero with two buttons             | No: left-aligned heading, one sentence, then the exercise           | No: heading above the exercise, not beside it                            | No                                   |
| Checkmark bullet trios, "How it works" columns           | None                                                                | None                                                                     | None                                 |
| Stat strips, social proof, a $0 card beside a paid one   | None                                                                | None                                                                     | None                                 |
| Coloured left-border callouts                            | None. The verdict is plain text.                                    | None                                                                     | None. The verdict has a full border. |
| Monospace eyebrow labels with middots                    | None. "Exercise 1 of 24 in Totals" is plain text under the heading. | None                                                                     | None                                 |
| System font, one blue accent, rounded cards everywhere   | Serif text, no blue, square corners                                 | Plex, violet only for "read", one 2 px panel around the working exercise | Atkinson, no blue, square corners    |
| Serif headline with one italic accent word               | No italics anywhere                                                 | n/a                                                                      | n/a                                  |
| Cards for lists, icons for words                         | The first exercises are an `<ol>`. The menu button says "Menu".     | Same                                                                     | Same                                 |
| Gradients, glass, blobs, illustrations, emoji, skeletons | None                                                                | None                                                                     | None                                 |

**Elements removed in review:**

- A small coloured square in front of Instrument's status word. It was decoration, neither a heading, a sentence, a table nor a control.
- The legend swatches stay. They are the key that pairs each colour with its word, as "colour never alone" requires.

**Fixed during the build, all re-checked afterwards:**

- On Marker's phone layout, "Next: Find the average" squeezed the input until the formula was cut off. On narrow screens the link now shows "Next", and its full name stays available to screen readers.
- The desktop header showed both the links and the Menu button. A CSS order bug, now fixed.
- An empty verdict box drew its border in Marker.

## Recommendation: B, Instrument

1. **It meets the core-loop rules with the most room to spare.** The verdict is directly under the input at about 500 px on a phone, and all four parts fit with 19 px left in the wrong state. On desktop all four sit above the fold side by side.
2. **It practises the real thing.** Gridlines, grey headers, a name box and a formula bar above the grid are what the learner sees in Excel at work. Each device does its real job.
3. **Colour has room to mean something.** The surroundings are neutral, so violet, red and green each carry one meaning. The primary button never uses them.

Two things are worth taking from the others, if you agree:

- **From Marker:** the highlighter-strength fill on cells the formula read. Instrument's tint is lighter. A stronger fill makes the error visible at a glance on a phone without changing the layout.
- **From Ledger:** the double rule above a total row, where a sheet has one. A small, real spreadsheet convention.

**Open items for Phase 5, whichever you choose:**

- Subset the fonts to the characters the site uses. Instrument's 77 kB is before subsetting.
- Tune fallback metrics, measured in WebKit as well, because Safari ignores `ascent-override` (research section 6).
- Add the states the mocks do not have: focus, hover, active, disabled, loading and empty.
- Test the real Check-to-Next swap with a screen reader.

**Your choice:** A, B, C, or B with the two borrowings.

## D. Workbench (chosen by the owner)

The owner rejected A, B and C as generic and chose Spreadsheet Center as the reference. The full study is in `docs/research/spreadsheetcenter.md`.

Direction D takes that look and fixes what the study found broken.

**Taken from Spreadsheet Center:**

- Inter, the gray scale, a `#F9FAFB` page with white panels, 1 px gray-200 lines and 4 to 6 px corners
- A white header with visible links
- On desktop, the task and details on the left at 40%
- The sheet on the right, on a pale green panel, under a green "Sheet" bar with Reset
- Name box and formula bar
- Excel's highlighted row and column headers for the answer cell
- A status bar under the sheet that turns green with a "Next" button when the answer is right
- Hints in `<details>`, and related functions as chips

**Fixed:**

- **The grid** is a server-rendered `<table>`, not a canvas.
- **On a phone** the sheet comes right after the task sentence. Task, input, grid and verdict end by 621 px of 812.
- **Every miss gets a verdict** naming the rule and the cell. The cells the formula read are outlined in Excel's reference blue, and the reference is repeated in the same blue in the verdict.
- **Check turns into Next in place**, in the status bar.
- **The green is `#18804F`** wherever there is text on it or in it; Spreadsheet Center's `#21A366` reaches only 3.23:1.
- **A dark theme** at equal quality.
- **A skip link** to the formula input.
- **None of their timer, streaks, sign-up banner, usage numbers or split hero.**

**Checks** (`docs/directions/d-workbench/checks.json`, `contrast.md`):

- **Contrast:** all 24 token pairs pass in both themes.
- **axe:** no serious or critical findings in either theme.
- **Fit:** task, input, grid and verdict fit on 375 by 812 and on 1280 by 800.
- **320 px:** no sideways scroll.
- **Copy linter:** passes.

**One deviation from the brief, for the owner to confirm:** cells use Inter with tabular figures, as Spreadsheet Center and Excel do. The brief asks for a monospace face in cells. The formula bar, the name box and references still use IBM Plex Mono.

**Mocks:**

- `docs/directions/d-workbench/exercise-initial.html`, `exercise-wrong.html` and `exercise-correct.html`
- Screenshots in `docs/directions/d-workbench/shots/`

Rebuild with `node docs/directions/d-workbench/build.ts`, then `node docs/directions/d-workbench/shoot.ts`.

## D, revision 2: closer to Spreadsheet Center (11 November 2026)

The owner asked for the site to look and work like Spreadsheet Center, and lifted the ban-list for these patterns:

- **Home:** split hero with two buttons and a solved sheet, a counts strip (real counts only), three offer cards, "How it works" in three numbered steps, a live exercise, "What makes it different", four audience cards, an FAQ and a closing call to action.
- **Shell:** logo mark, header search with suggestions, Exercises, Functions and Articles, Log in and a green Sign up. Dark footer with Learn and Support columns.
- **Catalogue:** topics are shown as learning tracks, with icon cards, time estimates and progress bars, one sortable table with difficulty badges, and a filter sidebar.
- **Exercise:** Exercise and Answer tabs, an optional timer, a draggable divider, empty rows and columns around the data on wide screens, related function chips and more exercises.
- **New:** articles, search, Log in, Sign up and a PRO waitlist. Accounts and the waitlist are UI only until a server exists (`siteConfig.accountsOpen`).
- **Shadows:** cards and the header carry soft shadows. The work area still uses hairlines.

Kept from our own build: the HTML table grid, the method-aware grader and verdicts, dark theme, skip link, `#18804F` for text contrast, no third-party requests and no cookie banner, because the site sets no cookies. Their name, logo, icons and copy are not used.

## D, revision 3: less template, more sheet (11 November 2026)

Revision 2 read as generated: seven centred "heading and subtitle" sections, decorative icons in green tiles, gradients, cards with shadows everywhere, and green on almost everything. This pass keeps the structure and takes the look from the spreadsheet itself.

- **Home, cut to the product:** the hero runs the first exercise live. A graded wrong attempt (`=SUM(B2:B4)`, rendered at build time by the grader and the verdict code) shows what a check says. Then the tracks as ruled rows and the questions as a plain list. How it works, What makes it different, Who it is for, the stats strip and the closing band are gone.
- **Hairlines, not cards:** lists are ruled rows under a grey band. Cards remain only for the filter panel and forms, with a border and no shadow. One radius, 6 px.
- **Colour roles:** green is the action and "correct", blue is "read by your formula", red is a miss. Everything else is grey. Difficulty is a word with three bars, not a coloured badge. PRO is a neutral outlined tag. The active tab is underlined in the text colour.
- **Icons:** only the timer's eye button keeps one. No arrows on links, no middots.
- **Fixes:**
  - The home sheet no longer shows empty padding rows.
  - Track progress appears only after something is solved.
  - The sync link to a disabled form is gone.
  - On phones the tabs sit above the task.
  - The sheet bar says Sheet1.
  - Step 2 no longer repeats the cell from step 1.
  - The function filter no longer scrolls on every key.
- **404:** shows `#REF!`, Excel's error for a reference to a cell that no longer exists.

## D, revision 4: back to Spreadsheet Center, every page type (11 November 2026)

The owner chose to match Spreadsheet Center over revision 3's plainer look, after a full crawl of the reference site (`docs/research/spreadsheetcenter-gaps.md`: 733 URLs, 28 page types).

- **Look restored:** cards with soft shadows, coloured difficulty pills, a purple PRO badge, green chips, the hero wash, icons, the blue active tab and the "Exercise" sheet bar. Revision 3's class names stay (`.level`, `.tag`, `.ruled`) but are drawn in this look.
- **Kept from revision 3:** the live exercise in the home hero, the graded wrong-answer example, phone tabs above the task, no padding rows on the home sheet.
- **Home:** split hero, stats, offers, how it works, the wrong-answer example, what makes it different, who it is for, tracks, FAQ, last call.
- **Catalogue:** pill note, track cards, Complete / Title / Difficulty table, start card and filters, beginner and work picks, FAQ.
- **Tracks:** grouped index (essentials with a dark summary panel, then one skill per track, how tracks work); track pages with what you'll learn, function chips, numbered exercise cards, Up next and where to go next. `content/track.yaml` gains `group` and `learn`.
- **Exercise:** the "Exercise completed" dialog with the next recommended exercise; closing it hands focus to Next.
- **New pages:** formula explainer and four walkthroughs (`content/explainers.yaml`, evaluated by the grader), keyboard shortcuts (`content/shortcuts.yaml`), resources, a contact form (opens the visitor's email program once `contactEmail` is set), forgot and reset password, verify email, account, profile, mock assessments, subscribe.
- **Functions:** search hero, task cards, function cards, all functions by category; function pages with a header example, syntax with its return type, arguments, exercises using the function, examples, what goes wrong, related chips and a sticky "On this page".

Not copied: their text, exercise wording, function guides, articles, name and logo.
