---

title: How to count unique values
description: Count how many different values a column holds, in current Excel and in older versions.
updated: 2026-11-16
minutes: 3
topic: sums
functions: [UNIQUE, COUNTA, FILTER, SUMPRODUCT, COUNTIF]
exercises: [count-functions-summary, count-orders-by-region, sumproduct-multiply-then-add]
cover: "=UNIQUE"
---

## Two different questions

"How many different customers ordered?" counts each name once, however often it appears. "How many customers ordered exactly once?" counts only names that appear one time.

## Different values, in current Excel

UNIQUE returns each value once. Count its result with COUNTA:

`=COUNTA(UNIQUE(A2:A500))`

If the range has empty cells, UNIQUE returns them as one extra value, shown as 0, and the count is one too high. Filter out the blanks first:

`=COUNTA(UNIQUE(FILTER(A2:A500, A2:A500<>"")))`

UNIQUE and FILTER need Excel for Microsoft 365 or Excel 2021 or later.

## Values that appear exactly once

Give UNIQUE TRUE as its third argument:

`=COUNTA(UNIQUE(A2:A500, , TRUE))`

## Different values, in older Excel

This works in every version:

`=SUMPRODUCT((A2:A500<>"")/COUNTIF(A2:A500, A2:A500&""))`

COUNTIF counts how often each value appears. A name that appears three times gets 1/3 on each of its three rows, so it adds up to 1. The `&""` stops blank cells returning `#DIV/0!`, and the `<>""` part gives them 0.

It is slow on many thousands of rows. On large data, use a helper column, or a PivotTable with Distinct Count, which needs the data added to the Data Model.

## Unique by a condition

To count different customers in the North region only:

`=COUNTA(UNIQUE(FILTER(A2:A500, B2:B500="North")))`

## Things to watch

- UNIQUE ignores case, so "acme" and "ACME" count as one.
- "Acme" and "Acme " with a trailing space count as two. Clean the column with TRIM first.
- If FILTER finds no rows, it returns `#CALC!`, and COUNTA counts that as 1. Give FILTER a third argument and handle that case.
