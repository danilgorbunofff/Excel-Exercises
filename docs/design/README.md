# Design system

Direction D, Workbench, built for the site. The look is the one you approved in Phase 2: Inter, a gray scale, white panels with 1 px hairlines, a green sheet bar, and Excel's blue for what a formula reads.

## Where things are

| Path                            | What it holds                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `src/styles/tokens.css`         | Every token: colour, type, spacing, radii, elevation, motion.                         |
| `src/styles/base.css`           | Fonts, reset, text, links, focus, the skip link and the shared button styles.         |
| `src/styles/font-fallbacks.css` | Local fallback fonts resized to the web fonts. Written by `tools/font-metrics.ts`.    |
| `src/components/`               | Header, footer, sheet, status bar, hint ladder and rich text. Each keeps its own CSS. |
| `src/scripts/`                  | The exercise script, its pure view logic and the progress store, with tests.          |
| `docs/design/contrast.md`       | Every colour pair, measured in both themes. Written by `src/styles/tokens.test.ts`.   |
| `docs/design/states.md`         | Every component in every state, light and dark. Written by `tools/shoot-states.ts`.   |
| `docs/design/shots/`            | The exercise screen at 375, 768 and 1280 px. Written by `tools/shoot-exercise.ts`.    |
| `docs/design/checks.json`       | Where the verdict ends on each screen size, and any sideways scroll.                  |

## Tokens

- **Colour.** Each state colour has one meaning, and a word always goes with it:
  - blue means read by your formula
  - red means a miss
  - green means correct
  - the darker green is the one action colour
- **Contrast.** 33 pairs are checked in both themes. Text needs 4.5:1, and UI parts and focus rings need 3:1. All pass, and the test fails if one stops passing.
- **Type.** Inter for text and cells, with tabular figures. IBM Plex Mono for formulas, references and the name box. Seven sizes from 12 to 32 px.
- **Spacing** is on a 4 px grid. **Radii** are 4 px, 6 px and a pill.
- **Elevation.** Areas are separated by hairlines, never by shadows. Only the menu dialog sits above the page.
- **Motion.** Colour changes on buttons take 150 ms, inside `prefers-reduced-motion: no-preference`. Nothing else moves.

## Fonts

Five files, all latin subsets in WOFF2 under the SIL Open Font Licence. The licences are next to them in `public/fonts/`.

- Inter 400, 600 and 700: 23.7, 24.5 and 24.4 kB. The 600 file also serves 500.
- IBM Plex Mono 400 and 600: 14.7 and 15.6 kB.

Only Inter 400 and 700 are preloaded. The local fallbacks are resized to the web fonts, measured in a browser:

- Arial at 105.93% for Inter.
- Courier New at 99.98% for Plex Mono.

The same paragraph at 320 px takes the same height in each pair. Run `node tools/font-metrics.ts` again if a font file changes.

## The exercise screen

- **Order on a phone:** task, sheet, verdict, then details. On wide screens the task and details sit on the left and the sheet on the right.
- **The grid is the data and nothing more.** The mocks had extra empty rows and columns. The brief calls anything that only looks like a spreadsheet decoration, so they are gone. This also keeps every seed grid on a phone screen.
- **A check shows on the data:**
  - the answer cell shows the result, in red or green with a word
  - every range the formula read is outlined in blue
  - the same references are marked in the formula text
  - the verdict names the rule and the cell, gives the exercise's own advice, and counts and totals what was read
- **Check becomes Next in place,** and focus moves to it. Editing the formula brings Check back.
- **Hints:** one button opens them in order. Step 2 compares your cells with the answer's cells. Step 3 shows the answer, and a later solve counts as solved with help.
- **Progress** stays in the browser's storage and nothing is sent. Blocked storage only means progress is not kept.

## Colour roles and shared pieces (revision 3)

- **Colour roles.** Each colour has one meaning:
  - green `--primary`: the one action and "correct"
  - blue `--read`: "read by your formula"
  - red `--miss`: a miss
  - everything else: greys
- **Tokens added for the shell:** `--heading`, `--faint`, the footer trio and `--shadow-pop`, which is used only by the menu and the search suggestions.
- **Shared classes in `base.css`:**
  - `.container`, `.card` (border only) and `.page-head`
  - `.ruled`, `.list-head` and `.section-title`
  - `.level` with `.level-1` to `.level-3`: a word with three bars
  - `.tag` for PRO
  - `.chips` and `.chip`: neutral mono
  - `.button-l`, `.progress-bar` and `.tabular`
- **Icons:** `src/components/Icon.astro` holds only the timer's eye icons.

## Decisions to confirm

- **Cells use Inter, not a monospace face.** The brief asks for monospace in cells. Excel and Spreadsheet Center use a proportional face with tabular figures. Switching is one line: `--font-cell` in `tokens.css`.
- **No loading state.** Nothing waits for the network, and grading takes a few milliseconds. `states.md` records the measurement.
- **At 320 by 640 the verdict ends below the screen.** Nothing scrolls sideways at that size. The fit requirement is for 375 by 812, where the verdict ends at 692 px in the wrong state.
