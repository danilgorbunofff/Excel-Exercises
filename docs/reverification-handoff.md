# Reverification handoff (2026-11-16)

Brief: `docs/exercise-reverification-prompt.md`. Report: `docs/reverification-report.md` (sections 1 to 5 written). Nothing committed, by the owner's rule.

## Done

- Phase 1 (grader against Excel): 577 cases, all non-locale diffs fixed or accepted in section 3. Replay `excel-parity.test.ts` passes.
- Phase 2 (every screen): 314 screens. 191 variants added, 9 wrong accepts moved to reject, grader fixes (MODE tie, typed 0 fallback, LET name thresholds, text vs number fragile message, binary search). Audit fixtures in `tools/audit/formulas/` (1048 correct, 628 wrong, 114 equivalent), replayed by `src/content/audit-fixtures.test.ts`. `checkedInExcel: 2026-11-16` on 231 of 234 files (3 locale files left null).
- Phase 3 (access, daily, mocks): done earlier; leak scan 0 leaks.
- Checks passing now: typecheck, `npm run test` (59 files, 5238 tests), content:validate, build (299 pages), lint:copy, budgets, motion. Lint: only the 3 baseline errors.

## Left to do

1. **e2e**: a full run (`E2E_PORT=4331 npx playwright test --workers=4 --reporter=line`) was at 1766 of 4128 when the session stopped. Rerun it, compare the failures with the baseline (45 failures: axe on `/pricing/` and six articles, duplicate title ageing-buckets). Put the result in place of `E2E_RESULT` in section 5 of the report.
2. **Fixture regeneration check**: content changed after `node tools/write-audit-fixtures.ts` ran (lead-conversion-rate 1 got `misses.reference`, switch-match-a-list-of-values 1 got 3 accepts, `checkedInExcel` set). `npm run test` passes, so fixtures still hold; optionally rerun the generator (needs Excel open) to pick up the new SWITCH accepts as correct forms.
3. **Final review of the report**: read `docs/reverification-report.md` once end to end; findings 22 to 31 and sections 4 and 5 are new. Copy rules: no dashes, no exclamation marks, sentences under 30 words.
4. **Owner decisions still open** (deferred table in section 2): track order (ROUND, AVERAGEIFS, TRIM taught late), mock phone-extension-for-a-name vs exercise extension-for-a-colleague near twins, reading-error-values 2 level 3 without variants.
5. **Needs an en-US Excel check** (cannot be done on this en_CZ Mac): card-payments-of-500-or-more, filter-amounts-stored-as-text, gross-margin-by-product 2, the 7 locale Phase 1 cases, `=HSTACK(A2:A3,B2:B4)` (crashes Excel under automation).
6. **Environment**: `node_modules/.cache/stale-dist/` holds 19 iCloud placeholder folders moved out of `dist/client` (they hung any walk of `dist`). Delete in Finder when iCloud sync works. Empty folders `test-results 2`, `3`, `4` at the root are iCloud copies too.
7. **Wrap up**: tell the owner the outcome; no commit, push or deploy unless asked.

## Rerun commands

- `node tools/audit-grader.ts` (Phase 1, Excel), `node tools/audit-tasks.ts` (Phase 2, Excel, incremental via `tools/audit/excel-cache.json`, `--cached-only` without Excel)
- `node tools/suggest-variants.ts [--apply]` then `npx biome format --write content`; refusals in `tools/audit/variant-skips.json`
- `node tools/write-audit-fixtures.ts`, `node tools/audit-access.ts` (after build)
