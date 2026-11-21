---

title: "Named ranges and Excel tables: when they help"
description: How names and tables make formulas easier to read and keep working when data grows.
updated: 2026-11-16
minutes: 4
topic: habits
functions: [SUMIFS, XLOOKUP, SUM]
exercises: [a-sales-summary-end-to-end, a-commission-sheet-that-updates-itself, sum-a-column]
cover: "Tbl[Amount]"
---

Make any list that more than one formula uses an Excel table, and give single inputs such as a rate a name. Both make formulas readable, and a table grows with its data.

## The problem they solve

`=SUMIFS($D$2:$D$500, $B$2:$B$500, "North")` works, but a reader has to check what column D holds. A value added in row 501 is left out of the total.

## Excel tables

Click inside a list and press Ctrl+T. Give the table a name on the Table Design tab, such as Sales.

The same formula then reads:

`=SUMIFS(Sales[Amount], Sales[Region], "North")`

The column names say what each range holds. New rows typed or pasted below the table join it, and every formula that uses the table includes them.

Type a formula in one cell of a new column and it fills the whole column. Inside the table, `[@Amount]` means the Amount on the same row, as in `=[@Amount]*[@Rate]`.

## Named ranges and named cells

Select a cell or range, type a name in the Name Box to the left of the formula bar, and press Enter. Manage names on the Formulas tab, in Name Manager.

Names help most for single input cells:

`=B2*VATRate` reads better than `=B2*$H$1`, and the name can never slide when the formula is copied.

## When to use which

- A list of records that will grow: an Excel table.
- One input value, such as a rate or a report date: a named cell.
- A fixed block that never changes size, such as a band table: either.

## Things to watch

- Filling a formula right or left with the fill handle moves a table column reference to the next column. Copy and paste keeps it. To lock it, write `Sales[[Amount]:[Amount]]`.
- Names do not show on the sheet. Keep a short list of inputs and their names in a labelled area.
- Deleting the cells a name points to leaves a name that returns `#REF!`. Check Name Manager for these after you delete rows or sheets.
- Excel 2003 and some other spreadsheet programs show tables as plain ranges.
