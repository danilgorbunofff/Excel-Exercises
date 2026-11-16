---

title: "Two-way lookup: find a value by row and column"
description: Return the value where a row label and a column heading meet.
updated: 2026-11-16
minutes: 4
functions: [INDEX, MATCH, XLOOKUP, VLOOKUP]
exercises: [two-way-index-match, two-way-lookup-with-vlookup-and-match, index-and-match-summary]
cover: "B2:F9"
---

## The task

A grid has products down column A and months across row 1. You want the sales for one product in one month. That needs two matches: one for the row, one for the column.

In the examples below, the product is in H2, the month is in H3, the products are in A2:A9, the months are in B1:F1, and the figures fill B2:F9.

## INDEX with two MATCHes

`=INDEX(B2:F9, MATCH(H2, A2:A9, 0), MATCH(H3, B1:F1, 0))`

The first MATCH finds which row of the grid holds the product. The second finds which column holds the month. INDEX returns the cell where they cross.

The row labels must line up with the grid rows, and the headings with the grid columns. A2:A9 goes with rows 2 to 9, and B1:F1 goes with columns B to F.

This works in every version of Excel.

## XLOOKUP inside XLOOKUP

`=XLOOKUP(H2, A2:A9, XLOOKUP(H3, B1:F1, B2:F9))`

The inner XLOOKUP finds the month in the headings and returns that whole column of figures. The outer XLOOKUP then finds the product and returns its value from that column.

It needs Excel for Microsoft 365 or Excel 2021 or later.

## VLOOKUP with MATCH

If you already use VLOOKUP, let MATCH supply the column number:

`=VLOOKUP(H2, A1:F9, MATCH(H3, A1:F1, 0), FALSE)`

Note that both ranges start in column A here. VLOOKUP counts columns from the first column of its range, so MATCH must count from the same place. If MATCH searched B1:F1 instead, every answer would come from one column too far to the left.

## Checks before you trust it

- Look up a product and month you can read off the grid by eye, and compare.
- Make sure the row labels and headings have no extra spaces.
- Months typed as text, such as "Jan", will not match real dates formatted to look like "Jan".
