---

title: VLOOKUP or XLOOKUP
description: Both find a value in a table. Here is how they differ, and which one to reach for.
updated: 2026-11-11
minutes: 5
topic: lookups
functions: [VLOOKUP, XLOOKUP, INDEX, MATCH]
exercises: [find-a-price, find-an-extension, delivery-band]
cover: "=XLOOKUP()"
---

## The job they share

A lookup takes a value you know, such as a product code, and returns a value you want from the same row, such as its price. Both functions do that job.

## How VLOOKUP reads a table

`=VLOOKUP(A2, D2:F20, 3, FALSE)` looks for A2 in the first column of D2:F20. It then returns the value from the third column of that range, on the matching row.

Three things often go wrong:

- The value you search for must be in the first column of the range.
- The column number breaks when someone inserts a column.
- Leaving out FALSE asks for an approximate match, which can return a wrong row without warning.

## How XLOOKUP reads a table

`=XLOOKUP(A2, D2:D20, F2:F20)` looks for A2 in D2:D20 and returns the value from F2:F20 on the same row. You point at the column to search and the column to return, so their order does not matter.

XLOOKUP looks for an exact match unless you ask otherwise. A fourth argument sets what to show when nothing matches, such as `"Not found"`.

## Which one to use

Use XLOOKUP when everyone who opens the file has Excel for Microsoft 365 or Excel 2021 or later. It is shorter and harder to break.

Use VLOOKUP when the file must open in older versions. Always give it FALSE as the last argument.

INDEX with MATCH works in every version and can look left too. It takes two functions instead of one.
