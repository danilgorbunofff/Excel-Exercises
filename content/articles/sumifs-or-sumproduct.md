---

title: "SUMIFS or SUMPRODUCT: which one to use"
description: Both add up the rows that pass a test. SUMIFS is faster to write and run. SUMPRODUCT handles tests SUMIFS cannot.
updated: 2026-11-16
minutes: 4
topic: sums
functions: [SUMIFS, SUMPRODUCT, SUMIF]
exercises: [sumifs-two-conditions-at-once, sumproduct-multiply-then-add, total-for-two-conditions]
cover: "=SUMIFS"
---

Use SUMIFS when each condition compares a column with a value. Use SUMPRODUCT when a condition needs a calculation, when you need OR, or when you multiply columns before adding.

## The same job, two ways

Say column A holds regions, column B holds products and column C holds sales. To total the sales for North and Widgets, both of these work:

`=SUMIFS(C2:C100, A2:A100, "North", B2:B100, "Widgets")`

`=SUMPRODUCT((A2:A100="North")*(B2:B100="Widgets")*C2:C100)`

They return the same number. The difference shows up when the tests get harder.

## How SUMIFS reads

SUMIFS takes the column to add first, then pairs of a range and a condition. A row is added only when every condition holds.

Conditions are written as text, so comparisons go in quotes:

- `">500"` for values over 500.
- `"<>Closed"` for anything except Closed.
- `">="&E1` for values at least as big as E1.
- `"*North*"` for text that contains North anywhere.

SUMIFS is fast and easy to read, and it works in every version since Excel 2007. Use it first.

## Where SUMPRODUCT wins

SUMPRODUCT multiplies lists row by row, then adds the results. Each test in brackets becomes a list of 1s and 0s, so a row counts only when every test gives 1.

Because the tests are ordinary formulas, you can do things SUMIFS cannot:

- Test a calculated value: `=SUMPRODUCT((MONTH(D2:D100)=3)*C2:C100)` totals March sales without a helper column.
- Use OR between conditions: `=SUMPRODUCT(((A2:A100="North")+(A2:A100="South")>0)*C2:C100)`.
- Multiply two columns before adding, such as price times quantity: `=SUMPRODUCT(C2:C100, E2:E100)`.

## Things that trip people up

- In SUMIFS, the sum range comes first. In SUMIF, it comes last. Mixing them up gives a wrong total with no error.
- In SUMPRODUCT, every range must be the same size. If one is a row longer, you get an error instead of a total.
- When the ranges are multiplied together, SUMPRODUCT returns `#VALUE!` if the sum column holds text, such as a dash typed in an empty month. SUMIFS skips text.
- SUMPRODUCT over whole columns, such as A:A, is slow. Give it a fixed range or an Excel table column.
