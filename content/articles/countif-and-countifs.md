---

title: COUNTIF and COUNTIFS with text, numbers, dates and blanks
description: How to write the condition for each kind of value, and the cases that count wrong.
updated: 2026-11-16
minutes: 4
functions: [COUNTIF, COUNTIFS, COUNTBLANK, COUNTA]
exercises: [count-paid-orders, countifs-several-conditions, count-over-a-limit, count-empty-cells]
cover: "=COUNTIFS"
---

## The shape of the formula

`=COUNTIF(B2:B100, "Paid")` counts the cells in B2:B100 that equal Paid. COUNTIFS takes more pairs of a range and a condition, and counts the rows where all of them hold:

`=COUNTIFS(B2:B100, "Paid", C2:C100, "North")`

Every range in COUNTIFS must be the same size, or the result is `#VALUE!`.

## Text

- `"Paid"` matches Paid, PAID and paid. Case does not matter.
- `"<>Paid"` counts everything that is not Paid, including blank cells.
- `"*late*"` counts cells that contain late anywhere. Read [wildcards in lookups](/articles/wildcards-in-lookups/) for more patterns.

## Numbers

Put the comparison and the number inside quotes:

- `">500"` more than 500.
- `"<=0"` zero or less.
- `500` exactly 500, with no quotes needed.

To compare with a cell, join the sign to it with `&`: `=COUNTIF(C2:C100, ">"&F1)`. Writing `">F1"` would compare with the text F1.

## Dates

Dates work like numbers. Build the condition from a cell or from DATE so the result does not depend on regional date formats:

`=COUNTIFS(D2:D100, ">="&DATE(2026,1,1), D2:D100, "<"&DATE(2026,2,1))`

This counts dates in January 2026. Using "less than the first of the next month" also catches dates that carry a time.

## Blanks

- `=COUNTBLANK(B2:B100)` counts empty cells. It also counts cells holding a formula that returns "".
- `=COUNTIF(B2:B100, "")` does the same.
- `=COUNTIF(B2:B100, "<>")` counts cells that are not empty.
- `=COUNTA(B2:B100)` counts every non-empty cell, including formulas that return "".

## OR conditions

COUNTIFS only does AND. For Paid or Refunded, add two counts:

`=COUNTIF(B2:B100, "Paid") + COUNTIF(B2:B100, "Refunded")`

## Common mistakes

- Numbers stored as text are not counted by `">500"`. Convert them first.
- A trailing space makes "Paid " differ from "Paid". Clean the column with TRIM.
- The ranges in COUNTIFS start on different rows, so the conditions test different records.
