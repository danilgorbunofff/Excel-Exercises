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

A spreadsheet error rarely shows itself. The number looks plausible, gets copied into a report and drives a decision. Each mistake below comes with a check that catches it.

## 1. A total that misses rows

New rows are added below the range, or a row is inserted just outside it. The total is low and nothing warns you.

Turn the data into an Excel table so the range grows, and compare the total with the source system's total.

## 2. Typed numbers inside formulas

`=B2*1.2` hides a rate. When the rate changes, nobody finds every formula that holds it.

Keep every rate and assumption in its own labelled cell. Home > Find & Select > Go To Special > Constants finds typed values among formulas.

## 3. A lookup without an exact match

VLOOKUP without FALSE returns a neighbour's value when the code is missing. The result looks fine.

Always give the match type. Read [approximate or exact match](/articles/approximate-or-exact-match/) for why.

## 4. IFERROR around everything

IFERROR turns a broken formula into a blank or a zero, so a problem disappears from view.

Use IFNA for missing lookups and let other errors show. A check cell can count the errors that remain.

## 5. Sorting only part of a table

Selecting one column and sorting it mixes up the rows. Names no longer match their amounts.

Sort from inside an Excel table, or select the whole table first. An ID column lets you restore the original order.

## 6. Numbers stored as text

They look right but are left out of totals and lookups.

Compare `=COUNT(range)` with the number of rows. Read [numbers stored as text](/articles/numbers-stored-as-text/) for the fixes.

## 7. Values pasted over formulas

Someone pastes values over one cell in a column of formulas. That cell stops updating.

Press `` Ctrl+` `` to show formulas and scan each calculated column.

## 8. Percent and units

A rate typed as 5 instead of 5% multiplies by 5, not 0.05. Thousands mixed with units throw totals off by a factor of 1,000.

Put the unit in every heading, and work out one result by hand.

## 9. Rounding in the wrong place

Rounding each line, then comparing with a total rounded once, gives small gaps that hide bigger ones.

Decide where rounding happens, and use ROUND on both sides when you compare totals.

## A habit that catches most of them

Add a checks area to every report: totals compared with the source, a count of errors, and one cell that says OK only when every check passes.
