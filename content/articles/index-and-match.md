---

title: "INDEX and MATCH: the lookup that works in every version"
description: How the pair splits a lookup into finding the row and fetching the value.
updated: 2026-11-16
minutes: 5
topic: lookups
functions: [INDEX, MATCH, VLOOKUP, XLOOKUP]
exercises: [match-find-a-position, index-a-value-at-a-row-and-column, index-match, find-a-code]
cover: "INDEX+MATCH"
---

## Two small jobs instead of one big one

A lookup does two things. It finds the row that holds the value you know, then it fetches a value from that row. INDEX and MATCH each do one of these jobs.

## MATCH finds the position

`=MATCH("B-204", D2:D20, 0)` returns the position of B-204 in D2:D20. If B-204 is in D5, the answer is 4, because D5 is the fourth cell of the range.

The last argument matters:

- `0` exact match. Use this for codes, names and IDs.
- `1` the largest value that is less than or equal to the one you search for. The range must be sorted ascending. This is the default when you leave the argument out.
- `-1` the smallest value that is greater than or equal. The range must be sorted descending.

Leaving out the 0 is a common INDEX and MATCH bug. The formula still returns a value, often from the wrong row.

## INDEX fetches the value

`=INDEX(F2:F20, 4)` returns the fourth cell of F2:F20, which is F5. On a block of cells, INDEX takes a row and a column: `=INDEX(D2:G20, 4, 3)` returns the cell in the fourth row and third column of the block.

## Put together

`=INDEX(F2:F20, MATCH(A2, D2:D20, 0))`

Read it from the inside out. MATCH finds which row of D2:D20 holds A2. INDEX returns the cell at that row in F2:F20.

Both ranges must start on the same row and have the same height. If one starts on row 2 and the other on row 3, every answer is one row off.

## Why use it when XLOOKUP exists

- It works in every version of Excel, including files shared with people on Excel 2016 or 2019.
- The return column can be anywhere, including to the left of the search column.
- Inserting or deleting columns does not break it, because there is no column number to count.
- MATCH on its own is useful. It answers questions such as "which row is this on" or "is this value in the list at all".

If everyone has Excel for Microsoft 365 or Excel 2021 or later, XLOOKUP does the same job in one function. Read [VLOOKUP or XLOOKUP](/articles/vlookup-or-xlookup/) for when to pick which.

## When nothing matches

MATCH returns `#N/A` when the value is not in the range, and INDEX passes it on. Wrap the whole formula in IFNA to show a message instead:

`=IFNA(INDEX(F2:F20, MATCH(A2, D2:D20, 0)), "Not found")`

Use IFNA rather than IFERROR. IFERROR also hides other errors, such as the `#NAME?` from a mistyped function name.
