---

title: "Approximate or exact match: why VLOOKUP returns the wrong row"
description: Why leaving out the last argument of VLOOKUP gives wrong answers, and when an approximate match is right.
updated: 2026-11-16
minutes: 4
topic: lookups
functions: [VLOOKUP, XLOOKUP, MATCH]
exercises: [delivery-band, find-an-extension, vlookup-and-xlookup-on-the-same-table]
cover: "TRUE/FALSE"
---

## The silent mistake

`=VLOOKUP(A2, D2:F20, 3)` has no fourth argument. Excel then assumes TRUE, which asks for an approximate match. On a list of codes or names, that can return a value from the wrong row with no error to warn you.

## What approximate match does

With TRUE, VLOOKUP assumes the first column is sorted from smallest to largest. It returns the row with the largest value that is less than or equal to the one you search for.

On sorted data with gaps, that is useful. On unsorted data, the search can stop at the wrong place and return any row at all.

If the value you search for is smaller than the first value in the column, the result is `#N/A`.

## When you want it: bands and tiers

Approximate match is right for a table of thresholds, such as delivery prices by weight:

- 0 kg costs 4.00
- 2 kg costs 6.50
- 10 kg costs 12.00

For a parcel of 3.4 kg, `=VLOOKUP(3.4, D2:E4, 2, TRUE)` finds 2, the largest threshold not above 3.4, and returns 6.50. The thresholds must be sorted ascending, and the first one should be the lowest possible value, often 0.

## When you do not: codes, names and IDs

For anything you look up by name or code, ask for an exact match with FALSE:

`=VLOOKUP(A2, D2:F20, 3, FALSE)`

Now a missing value gives `#N/A` instead of a wrong answer. An error you can see is safer than a wrong number you cannot.

## The same choice in other functions

- MATCH has the same default. Its last argument is 1 for approximate and 0 for exact. Give it 0 for codes.
- XLOOKUP defaults to an exact match. For bands, give it `-1` as the fifth argument. It then finds the next smaller value without needing the table sorted.

## A habit worth keeping

Type the last argument every time, even when you want the default. Anyone reading the formula then sees which kind of match you meant.
