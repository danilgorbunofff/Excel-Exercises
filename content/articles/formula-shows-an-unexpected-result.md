---

title: Why a formula shows a result you did not expect
description: The quiet causes of wrong results, from calculation mode to tiny decimal differences, and how to check each one.
updated: 2026-11-16
minutes: 4
topic: habits
functions: [ROUND, ISTEXT, SUBTOTAL, SUM]
exercises: [debug-a-total-that-skips-a-row, formula-audit-fix-five-broken-sheets, true-and-false-what-a-comparison-returns]
cover: "=0.1+0.2"
---

## The formula shows as text

If the cell shows `=SUM(A2:A10)` instead of a total, it was formatted as Text before you typed the formula. Change the format to General, click into the cell and press Enter.

If every formula on the sheet shows as text, Show Formulas is on. Press `` Ctrl+` `` to switch it off.

## The result does not update

If you change an input and nothing moves, the workbook may be set to manual calculation. Go to Formulas > Calculation Options and pick Automatic. Press F9 to recalculate once.

A workbook set to manual can switch other open workbooks to manual too.

## Two equal numbers are not equal

`=10.01-10=0.01` returns FALSE. Computers store most decimals as very close binary values, so 10.01-10 gives 0.00999999999999979.

Round before you compare:

`=ROUND(A2, 2) = ROUND(B2, 2)`

This matters most in checks that compare totals of money.

## The cell shows a rounded value

A cell formatted to two decimals can hold 10.004 but show 10.00. Adding many such cells gives a total that seems a cent or two off. Round the values with ROUND where the precision matters, not only the format.

## A total is too low

- Some numbers are stored as text, and SUM skips them. Check with `=ISTEXT(A5)`.
- The range stops short of new rows. Use an Excel table so it grows.
- A row in the middle was typed over with a value instead of a formula.

## A total is too high

- The range includes a subtotal row, so those amounts count twice.
- Hidden rows are included. SUM counts them. Use `=SUBTOTAL(109, A2:A100)` to add only the visible rows.

## Copied formulas give odd results

A reference that should be fixed moved when the formula was copied. Click a wrong cell and press F2. The coloured boxes show which cells it reads.

## A circular reference

If a formula refers to its own cell, directly or through other cells, Excel warns about a circular reference and may show 0. Find it under Formulas > Error Checking > Circular References.

## A good habit

Before trusting a new formula, check one result by hand. If it matches, check one at the edge of the data, such as the first or last row.
