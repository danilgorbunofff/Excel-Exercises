# Reverification handoff (2026-11-16)

Brief: `docs/exercise-reverification-prompt.md`. Report: `docs/reverification-report.md` (sections 1 to 5 written). Nothing committed, by the owner's rule.

## Done

- Phase 1 (grader against Excel): 577 cases, all non-locale diffs fixed or accepted in section 3. Replay `excel-parity.test.ts` passes.
- Phase 2 (every screen): 314 screens. 191 variants added, 9 wrong accepts moved to reject, grader fixes (MODE tie, typed 0 fallback, LET name thresholds, text vs number fragile message, binary search). Audit fixtures in `tools/audit/formulas/` (1048 correct, 628 wrong, 114 equivalent), replayed by `src/content/audit-fixtures.test.ts`. `checkedInExcel: 2026-11-16` on 231 of 234 files (3 locale files left null).
- Phase 3 (access, daily, mocks): done earlier; leak scan 0 leaks.
- Checks passing now: typecheck, `npm run test` (59 files, 5238 tests), content:validate, build (299 pages), lint:copy, budgets, motion. Lint: only the 3 baseline errors.

## Left to do (updated 2026-11-17)

Done since the first handoff: full e2e (44 failures, all baseline), lint at 0 errors, fixtures regenerated with Excel, browser spot check, report section 5. Commit `c5b1b34` is on `origin/main`.

Done on 2026-11-17 (findings 32 to 39, not committed): five Excel-checked correct forms on every screen apart from 2 locale screens, every screen read by hand, by-hand workbench runs, SLN and FV, criteria thresholds, daily tasks without required functions, case-sensitive function names, the week strip at 375 px.

Only items the owner or another machine can close:

1. **Owner decisions** (deferred table in section 2): track order (ROUND, AVERAGEIFS, TRIM taught late), the near twins `phone-extension-for-a-name` (mock) and `extension-for-a-colleague` (exercise), `reading-error-values` screen 2 at level 3 without variants, rounding on mock `average-sale-without-zeros`.
2. **Needs an en-US Excel check** (this Mac reads separators by en_CZ, and scripts cannot switch them): card-payments-of-500-or-more and filter-amounts-stored-as-text (both still short of five Excel-checked correct forms), gross-margin-by-product 2, the 7 locale Phase 1 cases, `=HSTACK(A2:A3,B2:B4)` (crashes Excel under automation).
3. **Environment**: delete `node_modules/.cache/stale-dist/` and the empty `test-results 2`, `3`, `4` folders in Finder.
4. **Deploy**: check whether the push to `main` started a Vercel production deploy. `npm run lhci` was not rerun; its baseline failure is `/pricing/` contrast.

## Rerun commands

- `node tools/audit-grader.ts` (Phase 1, Excel), `node tools/audit-tasks.ts` (Phase 2, Excel, incremental via `tools/audit/excel-cache.json`, `--cached-only` without Excel)
- `node tools/suggest-variants.ts [--apply]` then `npx biome format --write content`; refusals in `tools/audit/variant-skips.json`
- `node tools/write-audit-fixtures.ts`, `node tools/audit-access.ts` (after build)
