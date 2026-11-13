# Excel Exercises

Short exercises where you write one Excel formula on a real grid and get feedback in the browser.

This repository is at Phase 6: the quality gates, the grader in `packages/grader`, 24 seed exercises and two function pages in `content/`, the design system, and every page type of v1. `docs/content.md` explains the content files, `docs/design/README.md` the design system and `docs/pages/README.md` the pages.

## Requirements

- Node 24 (see `.nvmrc`). CI runs Node 24.
- Run `npx playwright install chromium firefox webkit` once for the browser tests.
- Lighthouse uses an installed Chrome.

## Commands

| Command                        | What it does                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`                  | Install dependencies.                                                                                                                 |
| `npm run dev`                  | Start the dev server at http://localhost:4321.                                                                                        |
| `npm run build`                | Build the static site into `dist/`.                                                                                                   |
| `npm run preview`              | Serve `dist/` locally.                                                                                                                |
| `npm run format`               | Format code with Biome.                                                                                                               |
| `npm run lint`                 | Lint and check formatting. Warnings fail.                                                                                             |
| `npm run typecheck`            | Type-check the grader with no DOM types, then the whole project with `astro check`.                                                   |
| `npm test`                     | Unit tests for the grader and the tools, with coverage.                                                                               |
| `npm run content:validate`     | Check every exercise file and `content/track.yaml` against the schema and against each other.                                         |
| `npm run lint:copy`            | Check the copy rules in content files and in every built page. Needs a build.                                                         |
| `npm run budgets`              | Check the gzipped size of every built page. Needs a build.                                                                            |
| `npm run motion`               | Check that every transition and animation in the built CSS is inside `@media (prefers-reduced-motion: no-preference)`. Needs a build. |
| `npm run e2e`                  | Playwright on Chromium, Firefox and WebKit: axe, the third-party request test, and page metadata. Needs a build.                      |
| `npm run lhci`                 | Lighthouse on a mobile profile against `dist/`. Reports go to `.lighthouseci/`. Needs a build.                                        |
| `npm run check:all`            | Every gate above, in the same order as CI.                                                                                            |
| `node tools/font-metrics.ts`   | Measure the web fonts against their local fallbacks and rewrite `src/styles/font-fallbacks.css`. Run when a font file changes.        |
| `node tools/shoot-exercise.ts` | Screenshot the exercise screen at 375, 768 and 1280 px, light and dark, and record the fit. Needs a build.                            |
| `node tools/shoot-pages.ts`    | Screenshot every page type at 375 and 1280 px, light and dark. Needs a build.                                                         |
| `node tools/shoot-states.ts`   | Screenshot every component state in both themes and time grading. Needs a build.                                                      |

## What the gates enforce

- **Copy rules** (`tools/lib/copy-lint.ts`): no em or en dashes, curly quotes, ellipsis characters, emoji or exclamation marks, and none of the listed marketing phrases. Sentences stay under 30 words and paragraphs under 70. Code in `<code>`, `<kbd>`, `<pre>` and elements marked `data-copy="off"` is skipped. In content files, prose fields are checked, formula fields are not, and code in prose goes in backticks.
- **Size budgets** (`tools/lib/budgets.ts`): HTML plus linked CSS under 40 kB gzipped, and JavaScript loaded by a route under 70 kB gzipped, on every page.
- **Reduced motion** (`tools/lib/motion.ts`): `transition*`, `animation*` and `scroll-behavior: smooth` only inside the `no-preference` media query.
- **Accessibility** (`tests/e2e/a11y.spec.ts`): no serious or critical axe findings on any route, in light and dark.
- **The exercise loop** (`tests/e2e/exercise.spec.ts`): what a wrong answer outlines and marks, Check turning into Next in track order, hints, progress, the skip link, the page without JavaScript, the phone fit, 320 px, the menu dialog, axe in the wrong and correct states, and every exercise accepting its own answer.
- **Pages** (`tests/e2e/pages.spec.ts`): one exercise order on every page, the same footer everywhere, honest breadcrumbs, valid structured data, no broken internal links, search from the 404 page, and the progress page.
- **Contrast** (`src/styles/tokens.test.ts`): every colour pair in `tokens.css` in both themes, 4.5:1 for text and 3:1 for UI parts.
- **Privacy** (`tests/e2e/privacy.spec.ts`): no request to any other origin from any route.
- **Metadata** (`tests/e2e/metadata.spec.ts`): every page has a title, description, canonical URL and one `h1` without JavaScript, they are unchanged after scripts run, titles are unique, and unknown addresses return the 404 page with status 404.
- **Lighthouse** (`lighthouserc.json`): Performance 90 or higher; Accessibility, Best Practices and SEO 100; CLS under 0.05; LCP under 2.5 s.
- **Grader isolation** (`packages/grader/tsconfig.json`): the grader is type-checked with no DOM library, so DOM use fails.

The routes the e2e tests visit come from the built `sitemap.xml`, which is derived from the page files. A new page is tested without anyone adding it by hand.

## Layout

| Path               | Contents                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| `packages/grader/` | The formula grader. Pure TypeScript, no DOM. Built in Phase 3.                |
| `content/`         | Exercise files and `track.yaml`, the single exercise order.                   |
| `src/`             | The Astro site. `src/content/schema.ts` is the content schema shared with CI. |
| `tools/`           | Build-time checks. Logic in `tools/lib/` is unit-tested.                      |
| `tests/e2e/`       | Playwright tests.                                                             |
| `site.config.ts`   | Owner facts and configured numbers. `TODO(owner)` marks placeholders.         |

## Environment

No environment variables are needed. See `.env.example`. Never commit secrets.
