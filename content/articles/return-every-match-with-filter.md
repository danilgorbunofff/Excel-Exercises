---

title: Return every match with FILTER
description: Lookups stop at the first match. FILTER returns all of the matching rows, and updates when the data changes.
updated: 2026-11-16
minutes: 4
functions: [FILTER, SORT, TEXTJOIN, XLOOKUP, COUNTIF]
exercises: [count-orders-by-region, xlookup-search-from-the-bottom, lookup-functions-summary]
cover: "=FILTER()"
---

## Lookups return one row

VLOOKUP, XLOOKUP and INDEX with MATCH all return the first match they find. If a customer has five orders, you see only one of them. To see all five, use FILTER.

FILTER needs Excel for Microsoft 365 or Excel 2021 or later.

## The basic formula

`=FILTER(A2:D100, B2:B100=H2, "No orders")`

- The first argument is what to return, here the whole table A2:D100.
- The second is the test, one TRUE or FALSE per row. Here it keeps rows where column B equals H2.
- The third is what to show when no row passes.

The matching rows spill into the cells below and to the right. Leave those cells empty, or you get `#SPILL!`.

## Two or more conditions

Multiply the tests when every condition must hold, and add them when any one is enough:

- Both: `=FILTER(A2:D100, (B2:B100=H2)*(C2:C100>500))`
- Either: `=FILTER(A2:D100, (B2:B100="North")+(B2:B100="South"))`

Each test goes in its own brackets.

## Sorted results

Wrap FILTER in SORT to order the rows. This sorts by the fourth column, largest first:

`=SORT(FILTER(A2:D100, B2:B100=H2), 4, -1)`

## Every match in one cell

To list the matches in a single cell, join them with TEXTJOIN:

`=TEXTJOIN(", ", TRUE, FILTER(D2:D100, B2:B100=H2, ""))`

This returns something like "1042, 1057, 1081".

## Return the last match instead

If you only need the most recent match, you do not need FILTER. XLOOKUP can search from the bottom:

`=XLOOKUP(H2, B2:B100, D2:D100, , , -1)`

## How many matches there are

To count the matches without listing them, use COUNTIF:

`=COUNTIF(B2:B100, H2)`

## Common mistakes

- The test range and the returned range have different heights. FILTER then returns `#VALUE!`.
- The data is a fixed range and new rows are added below it. Turn the data into an Excel table, so the range grows with it.
- Another formula refers to a single cell of the spilled result. Refer to the whole result with a hash after the first cell, such as `F2#`.
