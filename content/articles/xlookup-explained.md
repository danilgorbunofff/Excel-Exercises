---

title: XLOOKUP explained, argument by argument
description: What each of the six XLOOKUP arguments does, with a worked example for each one you will use.
updated: 2026-11-16
minutes: 5
topic: lookups
functions: [XLOOKUP, IFNA]
exercises: [find-a-price, xlookup-with-a-fallback-when-nothing-matches, xlookup-search-from-the-bottom]
cover: "=XLOOKUP"
---

## The short version

`=XLOOKUP(A2, D2:D20, F2:F20)` finds A2 in D2:D20 and returns the value from F2:F20 on the same row. Three arguments cover most lookups. The other three change what happens when there is no exact match, or which match wins.

XLOOKUP works in Excel for Microsoft 365, Excel 2021 and later, and Excel for the web. Older versions show `#NAME?` instead of a result.

## The three you always give

**lookup_value** is the value you know, such as a product code in A2.

**lookup_array** is the single column or row to search, such as D2:D20.

**return_array** is the column or row to return from, such as F2:F20. It must be the same height as the lookup_array. If it is not, XLOOKUP returns `#VALUE!`.

Because you point at the two columns separately, the return column can sit to the left of the search column. Inserting a column between them does not break the formula.

## if_not_found: what to show when nothing matches

Without it, a missing value returns `#N/A`. Give a fourth argument to show something else:

`=XLOOKUP(A2, D2:D20, F2:F20, "Not found")`

Use a text message for people reading the sheet, or 0 when the result feeds a sum. This replaces wrapping the formula in IFNA.

## match_mode: exact or the nearest value

The fifth argument decides what counts as a match:

- `0` exact match only. This is the default.
- `-1` exact match, or else the next smaller value.
- `1` exact match, or else the next larger value.
- `2` a wildcard match, where `*` and `?` stand for other characters.

Use `-1` for bands, such as finding the discount for an order of 37 units when the table lists 0, 25 and 50. Unlike VLOOKUP, the table does not need to be sorted for this.

## search_mode: which match wins

The sixth argument sets the direction of the search:

- `1` from the first row down. This is the default.
- `-1` from the last row up, which returns the last match.
- `2` and `-2` a fast binary search on data sorted ascending or descending.

`=XLOOKUP(A2, D2:D20, F2:F20, , , -1)` returns the most recent entry for A2 when new rows are added at the bottom. The empty arguments keep the defaults.

## Returning several columns at once

If the return_array is more than one column wide, XLOOKUP returns the whole matching row:

`=XLOOKUP(A2, D2:D20, E2:G20)`

The result spills into the cells to the right. If something already sits in those cells, you get `#SPILL!` until you clear them.

## Common mistakes

- The lookup_array and return_array start on different rows, such as D2:D20 and F3:F21. Every result is then one row off.
- The ranges are not locked before the formula is copied down. Use D$2:D$20 or an Excel table.
- A code is stored as text in one column and as a number in the other, so nothing matches.
