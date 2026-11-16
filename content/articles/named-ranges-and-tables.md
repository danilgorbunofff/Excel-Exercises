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

## The problem they solve

`=SUMIFS($D$2:$D$500, $B$2:$B$500, "North")` works, but a reader has to check what column D holds. And when row 501 is added, it is left out.

## Excel tables

Click inside a list and press Ctrl+T. Give the table a name on the Table Design tab, such as Sales.

The same formula then reads:

`=SUMIFS(Sales[Amount], Sales[Region], "North")`

What you gain:

- **Readable formulas.** Column names say what each range holds.
- **Ranges that grow.** New rows typed or pasted below the table join it, and every formula that uses it includes them.
- **Calculated columns.** Type a formula in one cell of a new column and it fills the whole column.
- **This row.** Inside the table, `[@Amount]` means the Amount on the same row, such as `=[@Amount]*[@Rate]`.

## Named ranges and named cells

Select a cell or range, type a name in the Name Box to the left of the formula bar, and press Enter. Manage names on the Formulas tab, in Name Manager.

Names help most for single input cells:

`=B2*VATRate` reads better than `=B2*$H$1`, and the name can never slide when the formula is copied.

## When to use which

- A list of records that will grow: an Excel table.
- One input value, such as a rate or a report date: a named cell.
- A fixed block that never changes size, such as a band table: either.

## Things to watch

- **Dragging sideways.** Filling a formula across columns with the mouse moves a table column reference to the next column. Copy and paste keeps it. To lock it, write `Sales[[Amount]:[Amount]]`.
- **Hidden names.** Names are not visible on the sheet. Keep a short list of inputs and their names in a labelled area.
- **Old names.** Deleting the cells a name points to leaves a name that returns `#REF!`. Clean up Name Manager now and then.
- **Sharing.** Very old versions and some other spreadsheet programs show tables as plain ranges.

## A good default

For any list longer than a few rows that more than one formula uses, make it a table first. It costs a second and prevents the most common "the total missed the new rows" mistake.
