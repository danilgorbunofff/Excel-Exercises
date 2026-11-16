---

title: Look up a value on another sheet or in another file
description: How to point a lookup at another sheet or workbook, and keep the link working.
updated: 2026-11-16
minutes: 4
functions: [XLOOKUP, VLOOKUP]
exercises: [order-details-from-two-tables, a-lookup-dashboard-from-three-tables, trial-balance-lookup-and-check]
cover: "Prices!A:B"
---

## Another sheet in the same file

Put the sheet name and an exclamation mark before the range:

`=XLOOKUP(A2, Prices!A2:A200, Prices!C2:C200)`

You rarely need to type this. Start the formula, click the other sheet's tab, select the range, and Excel writes the sheet name for you.

If the sheet name contains a space or a hyphen, Excel wraps it in single quotes:

`=XLOOKUP(A2, 'Price list'!A2:A200, 'Price list'!C2:C200)`

## Another workbook

With both files open, select the range in the other file the same way. Excel adds the file name in square brackets:

`=XLOOKUP(A2, [Prices.xlsx]Sheet1!$A$2:$A$200, [Prices.xlsx]Sheet1!$C$2:$C$200)`

When the other file is closed, the formula shows its full folder path. The values come from the last time Excel read the file.

## Why links to other files break

- The other file is renamed or moved. Excel can no longer find it and keeps the old values.
- The other file is on a drive that a colleague cannot reach.
- Someone inserts rows above the data in the other file while your file is closed. Your ranges do not move with them.

To see or repair the links, open the Data tab and use Workbook Links. In older versions it is called Edit Links.

If you can, copy the lookup data into a sheet of the same file instead. One file is easier to share and check.

## Use a table so the range grows

Fixed ranges such as A2:A200 miss any rows added below row 200. Turn the data into an Excel table with Ctrl+T and give it a name, such as Prices. Then the formula reads:

`=XLOOKUP(A2, Prices[Code], Prices[Price])`

The table grows as rows are added, the names say what each column holds, and the reference does not shift when the formula is copied.

## Whole columns

`=XLOOKUP(A2, Prices!A:A, Prices!C:C)` also works and never misses new rows. A table is still easier to read, because its column names say what each range holds.
