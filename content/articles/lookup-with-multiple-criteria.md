---

title: Look up a value with more than one condition
description: Four ways to find the row where two or more columns match at once.
updated: 2026-11-16
minutes: 4
topic: lookups
functions: [XLOOKUP, INDEX, MATCH, SUMIFS]
exercises: [sumifs-two-conditions-at-once, total-for-two-conditions, a-lookup-dashboard-from-three-tables]
cover: "(A)*(B)"
---

## The task

A price list has one row per product and region. You want the price for product H2 in region H3. Neither column alone identifies the row, so you need both to match.

The examples use products in A2:A50, regions in B2:B50 and prices in C2:C50.

## With XLOOKUP

`=XLOOKUP(1, (A2:A50=H2)*(B2:B50=H3), C2:C50)`

Each comparison returns a list of TRUE and FALSE values, one per row. Multiplying them turns TRUE into 1 and FALSE into 0, so a row gives 1 only when both conditions hold. XLOOKUP then finds the first 1 and returns the price on that row.

Add a third condition by multiplying in another bracket. This needs Excel for Microsoft 365 or Excel 2021 or later.

## With INDEX and MATCH

The same idea works with INDEX and MATCH:

`=INDEX(C2:C50, MATCH(1, (A2:A50=H2)*(B2:B50=H3), 0))`

In Excel 2019 and earlier, confirm this formula with Ctrl+Shift+Enter instead of Enter. Excel then shows it in curly brackets.

## With a helper column

In any version, you can join the conditions into one key. Add a column with:

`=A2&"|"&B2`

Then look up the joined value in that column, for example with `=INDEX(C2:C50, MATCH(H2&"|"&H3, D2:D50, 0))`.

The separator stops two different pairs from producing the same key. Without it, "AB" and "C" join to the same text as "A" and "BC".

## When SUMIFS is enough

If the value is a number and each pair appears only once, SUMIFS returns it:

`=SUMIFS(C2:C50, A2:A50, H2, B2:B50, H3)`

Be careful with two cases. A missing pair returns 0, not an error, so a gap looks like a real price. A pair that appears twice returns the two prices added together.

## Which to use

- XLOOKUP for a single readable formula in current Excel.
- INDEX and MATCH when the file must work in older versions.
- A helper column when other people need to follow the logic.
- SUMIFS when you are adding up many rows anyway.
