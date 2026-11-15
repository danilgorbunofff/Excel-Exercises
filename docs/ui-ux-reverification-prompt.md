# UI/UX reverification prompt

Paste everything below the line into a new Claude Code session opened in this repository.

---

## Role

You are a principal product designer and front-end developer with 15+ years of experience shipping learning products, design systems and accessible web apps. You review work the way a design-director would in a pre-launch critique: evidence first, severity-ranked, specific fixes, no flattery.

## Goal

Reverify the UI and UX of every page of this site (excelexercises.online, Astro, source in `src/pages/`) against the reference it was inspired by, https://spreadsheetcenter.com/. For each page, decide whether we match the reference where the owner chose to match it, beat it where the brief says to beat it, and deviate only for a documented reason. Then fix what is wrong, or list it if the fix needs an owner decision.

## Ground truth you must read first (do not re-crawl the reference)

The reference was already studied. Reuse it instead of repeating the work:

- `docs/research/spreadsheetcenter.md`: full study. Sections 4 (visual language: layout, type, colour, shape, components), 5 (page by page), 6 (exercise flow state by state), 11 (where the reference conflicts with our brief), 12 (what to adopt).
- `docs/research/spreadsheetcenter-gaps.md`: page-type map, what each of their pages contains, what we built.
- `docs/research/spreadsheetcenter/shots/`: 110 reference screenshots at 1280 and 375 px, viewport and `-full`, plus dark variants and `flow-01` to `flow-11` for every exercise state. Page names: home, exercises, tracks, track, exercise-basic/lookup/advanced, functions, function-sumif/xlookup, articles, article, explainers, explainer, shortcuts, assessments, subscribe, resources, contact, login, register, privacy, search, not-found, phone-menu-open.
- `docs/research/spreadsheetcenter/inspect.json` and `flow.json`: measured values and keyboard tab stops.
- `docs/design/README.md`, `docs/design/contrast.md`, `docs/design/states.md`, `docs/design/checks.json`, `src/styles/tokens.css`: our own design system and its claims.
- `docs/directions.md`, `docs/research.md`, `docs/content.md`, `docs/launch.md`: the brief, bans and non-negotiables.
- Memory note on owner decisions (stack, hint depth, Excel locale, Phase 7 accounts, PRO lock rule).

Only open https://spreadsheetcenter.com/ live when a screenshot is missing, or a value in `inspect.json` looks wrong. Before trusting a stored shot, check it is not older than the question you are asking. Never copy their text, exercise wording, logo or function guides.

## Rules of judgement

1. The reference is an inspiration, not a spec. The brief overrides it. Section 11 of the study lists deliberate deviations (no split hero, no stat strip, no streaks, no gradients, no stopwatch, no canvas grid, `#18804F` instead of `#21A366` under text, one ordering everywhere, a grader that explains every miss). Do not report those as defects. Do report a deviation that is not in section 11 and not justified in the brief.
2. Every finding needs evidence: page URL, viewport, theme, a screenshot path, the measured value, and the reference page or brief rule it breaks. No "feels off" findings.
3. Separate three kinds of finding: (a) parity gap (reference has it, we should), (b) regression versus our own design system or brief, (c) improvement beyond the reference.
4. Severity: S1 blocks a task or fails WCAG 2.2 A/AA; S2 clearly hurts comprehension, trust or conversion; S3 polish; S4 nice to have.

## Scope: every page

Reverify each route. Use the real route list, not memory: run `find src/pages -name '*.astro' | sort` and `src/pages/sitemap.xml.ts`, then expand dynamic routes (`[slug]`) to at least one of every distinct content type and to the longest and shortest content you can find.

Page types (map ours to theirs using the gaps table):

- Home `/`
- Exercises catalogue `/exercises/`; tracks index `/exercises/tracks/`; a track `/exercises/tracks/[slug]/`
- Exercise `/exercises/[slug]/`: basic, lookup, advanced, PRO-locked, and an exercise with many hints
- Functions index `/functions/`; function page `/functions/[slug]/` (SUM, VLOOKUP)
- Formula explainer index and page
- Articles index and article
- Excel shortcuts, Resources, Search, Contact
- Auth: login, register, forgot-password, reset-password, verify
- Signed-in: account, profile, progress, mock-assessments
- Pricing, subscribe, Privacy, Terms
- 404

Also review cross-page: header, footer, mobile menu, search, breadcrumbs, skip link, focus order, theme switching, favicon and share images.

## Test matrix per page

- Viewports: 320, 375, 768, 1024, 1280, 1920 px. Plus landscape phone for the exercise screen.
- Themes: light and dark.
- Account state: signed out, signed in free, signed in PRO (where the route differs).
- Input: mouse, keyboard only, touch emulation, `prefers-reduced-motion: reduce`, 200% browser zoom, 400% reflow at 320 px, forced-colors if feasible.
- Data states: empty, loading, error, success, long text, zero results, offline.
- Exercise states: initial, hint 1/2/3 open, wrong answer, correct answer, after reload, pane divider dragged and keyboard-resized, Reset.

Capture screenshots with the existing tooling where it already covers the case (`tools/shoot-pages.ts`, `tools/shoot-states.ts`, `tools/shoot-exercise.ts`, `npm run e2e`, `npm run lhci`, `npm run motion`, `npm run budgets`, `npm run lint:copy`), and Playwright for the rest. Save new shots under `docs/design/reverify/<page>-<viewport>-<theme>.jpg`. Put each of ours next to the matching reference shot in the report.

## What to check on every page

### 1. Parity with the reference (where chosen)
- Information architecture and section order versus the matching page in section 5 of the study.
- Page background, panel white, 1 px hairlines, content widths (1280 page, 768/896 reading, 448 forms).
- Header: logo, search, nav, auth actions; phone menu behaviour versus `phone-menu-open.jpg`.
- Components: primary/secondary/small buttons, tabs, difficulty badges, function chips, name box and formula bar, grid header bar with Reset, completion bar with "Next exercise", numbered track list with "Up next".
- Exercise screen: 40/60 two-pane desktop layout, draggable and keyboard-operable divider, stacked on phone, answer cell marked before and after.

### 2. Visual design
- Tokens only: no hard-coded colours, sizes or radii outside `tokens.css`. Grep for stray hex, `px` font sizes, magic margins.
- Type scale, line length (45 to 75 characters for prose), heading hierarchy, tabular figures in cells, monospace for formulas and references.
- 4 px spacing grid, consistent radii (4, 6, pill), no shadows except the permitted dialog.
- Colour meaning is consistent: blue read by formula, red miss, green correct, dark green action. A colour is never the only signal.
- Imagery, icons, empty areas, alignment, optical balance, orphan words, widows, overflow, clipped focus rings.

### 3. UX and flow
- First 5 seconds: can a new visitor tell what this is and start an exercise without scrolling or signing up?
- Primary path: land, pick exercise, solve, get explained feedback, go next. Count clicks and decision points; compare with the reference flow (`flow-01` to `flow-11`).
- Wrong-answer feedback explains the miss (the reference stays silent; we must not). Hints reveal one at a time and cost nothing hidden.
- Signed-out versus signed-in versus PRO: lock rule is clear, honest and never a dead end. No dark patterns, no sign-up pressure.
- Progress persistence, reload behaviour, Reset safety (no accidental data loss), undo.
- Navigation: orientation (breadcrumbs, current page, "Up next"), search quality, 404 recovery, cross-links between exercise, function, explainer and article.
- Forms: labels, helper text, inline validation, error summary, autofill, password manager, success and failure states, disabled states that say why.
- Microcopy: plain, specific, consistent verbs, no fabricated numbers, no promises the product does not keep. Run `npm run lint:copy`.

### 4. Accessibility (WCAG 2.2 A and AA)
- axe on every page and state; manually confirm what axe cannot see.
- Contrast for every text and UI pair in both themes (our target: 4.5:1 text, 3:1 UI and focus). Compare with `docs/design/contrast.md`.
- Keyboard: skip link, logical tab order, visible focus on every control, no trap (the reference traps focus in the grid; we must not), Escape closes dialogs and returns focus to the trigger, arrow keys on divider and tabs.
- Semantics: landmarks, one `h1`, no skipped heading levels, real `table` for the grid with headers, `tablist` pattern correct, `aria-live` for verdict changes, no duplicate IDs, accessible names for icon buttons.
- Target size at least 24 px (prefer 44 px on touch), pointer gestures have alternatives, no content only on hover.
- Motion: respects `prefers-reduced-motion`; nothing flashes.
- Zoom and reflow: no horizontal scroll at 320 px or 400% zoom, no clipped text at 200% text size.

### 5. Responsive behaviour
- Breakpoint transitions at 375/768/1024/1280, not just the endpoints. Look for jumps, cramped tables, tap targets under 24 px, sticky elements covering content, keyboard covering inputs on phone.
- The exercise page on a phone: instructions first, grid reachable, verdict visible without hunting; compare with the reference's 1,260 px gap before the grid.
- Tables (catalogue, shortcuts, arguments) have a deliberate small-screen form.

### 6. Performance as it is felt
- Largest contentful paint, layout shift, interaction latency per page; fonts load without a visible jump (fallbacks in `font-fallbacks.css`); JS budget (70 kB) holds (`npm run budgets`); no render-blocking third-party requests.
- Perceived speed: skeletons or instant content, no empty grid flash.

### 7. Trust, SEO and share surface
- Titles, descriptions, canonical, Open Graph and Twitter images, JSON-LD (BreadcrumbList, FAQPage where used), `robots.txt`, sitemap, 404 returns status 404.
- Legal pages readable, consistent with what the product does with data. No cookie banner needed only if no cookies are set: verify in the browser.

## Method

1. Read the ground-truth files above. State in five lines what the reference does well, where it fails, and which deviations are intentional.
2. Build the page inventory and a coverage table (page x viewport x theme x state). Do not skip a cell silently; mark it "not applicable" with a reason.
3. For each page, capture ours and open the matching reference shot beside it. Fill in the checklist above. Measure with the browser (computed styles, bounding boxes), not by eye.
4. Run the automated gates and record results: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run lint:copy`, `npm run budgets`, `npm run motion`, `npm run e2e`, `npm run lhci`.
5. Rank findings. Fix every S1 and S2 that is unambiguous and within the design system. Do not invent new patterns. For anything that needs an owner decision, list it with two options and your recommendation. Commit nothing until I say so.
6. After fixes, rerun the affected shots and gates and show before and after.

## Deliverables

1. `docs/design/reverify/REPORT.md` containing:
   - Verdict per page: Pass, Pass with notes, Fail, each with one-sentence reason.
   - Coverage table.
   - Findings table: ID, page, viewport/theme/state, severity, kind (parity, regression, improvement), evidence (our shot, reference shot, measured value), rule broken, fix, status.
   - Deviations from the reference that are intentional and still correct.
   - Deviations that are not justified.
   - Decisions needed from the owner.
   - Top 10 things to fix first.
2. Side-by-side images in `docs/design/reverify/` (ours versus reference) for every S1 and S2 finding.
3. The fixes themselves, as small reviewable diffs grouped by theme (tokens, layout, accessibility, copy), with the gate results.
4. A closing summary in under 150 words: what passed, what failed, what is left, what you did not verify.

## Constraints

- Do not copy the reference's text, brand, logo or content.
- Do not weaken a brief rule to match the reference.
- Do not add dependencies or exceed the JS budget.
- Never claim a page passed without having opened it at the stated viewports and themes. If you could not test a cell, say so.
- Do not create accounts on the live reference, and do not submit any form on a production site. Use the local preview and test values only.
