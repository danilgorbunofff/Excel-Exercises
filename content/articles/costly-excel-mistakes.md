---

title: Excel mistakes that cost money, and how to catch them
description: The errors behind most wrong reports, from short ranges to hidden typed numbers, and a check for each.
updated: 2026-11-16
minutes: 5
topic: habits
functions: [SUM, ROUND, VLOOKUP, IFERROR, COUNTIF]
exercises: [debug-a-total-that-skips-a-row, formula-audit-fix-five-broken-sheets, a-monthly-close-checklist-in-formulas]
cover: "=SUM(B2:B9)"
---

## Why small mistakes get expensive

A spreadsheet error rarely shows itself. The number looks plausible, gets copied into a report and drives a decision. The mistakes below are common, quiet and easy to check for.

## 1. A total that misses rows

New rows are added below the range, or a row is inserted just outside it. The total is low and nothing warns you.

**Check:** turn the data into an Excel table, and compare the total with the source system's total.

## 2. Typed numbers inside formulas

`=B2*1.2` hides a rate. When the rate changes, nobody finds every formula that holds it.

**Check:** keep every rate and assumption in its own labelled cell. Use Go To Special, Constants, to find typed values among formulas.

## 3. A lookup without an exact match

VLOOKUP without FALSE returns a neighbour's value when the code is missing. The result looks fine.

**Check:** always give the match type. Read [approximate or exact match](/articles/approximate-or-exact-match/) for why.

## 4. IFERROR around everything

IFERROR turns a broken formula into a blank or a zero, so a problem disappears from view.

**Check:** use IFNA for missing lookups and let other errors show. Count errors with a check cell.

## 5. Sorting only part of a table

Selecting one column and sorting it mixes up the rows. Names no longer match their amounts.

**Check:** sort from inside an Excel table, or select the whole table first. Keep an ID column so the original order can be restored.

## 6. Numbers stored as text

They look right but are left out of totals and lookups.

**Check:** compare `=COUNT(range)` with the number of rows. Read [numbers stored as text](/articles/numbers-stored-as-text/) for the fixes.

## 7. Values pasted over formulas

Someone pastes values over one cell in a column of formulas. That cell stops updating.

**Check:** press `` Ctrl+` `` to show formulas and scan each calculated column.

## 8. Percent and units

A rate typed as 5 instead of 5% multiplies by 5, not 0.05. Thousands mixed with units throw totals off by a factor of 1,000.

**Check:** label units in every heading, and sanity-check one result by hand.

## 9. Rounding in the wrong place

Rounding each line, then comparing with a total rounded once, gives small gaps that hide bigger ones.

**Check:** decide where rounding happens, and compare totals with ROUND on both sides.

## A habit that catches most of them

Add a checks area to every report: totals compared with the source, a count of errors, and one cell that says OK only when every check passes.
