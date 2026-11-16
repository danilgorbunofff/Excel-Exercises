---

title: Running total and cumulative percent
description: Add a total that grows row by row, and show how much of the whole each row has reached.
updated: 2026-11-16
minutes: 3
topic: sums
functions: [SUM, SCAN, LAMBDA, SORT]
exercises: [running-total-down-a-column, share-handed-in, top-customer-share-of-revenue]
cover: "=SUM($B$2:B2"
---

## The running total

With amounts in B2:B13, type this in C2 and copy it down:

`=SUM($B$2:B2)`

The start of the range is locked with dollar signs and the end is not. In C3 the formula becomes `=SUM($B$2:B3)`, in C4 `=SUM($B$2:B4)`, and so on. Each row adds everything from the top down to itself.

## The other common way

`=C1+B2` in C2, copied down, also builds a running total. It is shorter, but it breaks if C1 holds a heading, and a deleted row turns every cell below into `#REF!`. The SUM version has neither problem.

## Cumulative percent

Divide the running total by the grand total:

`=SUM($B$2:B2) / SUM($B$2:$B$13)`

Format the column as a percentage. The last row shows 100 percent.

This is the basis of a Pareto check, such as "which customers make up 80 percent of revenue". Sort the customers from largest to smallest first, then find the row where the cumulative percent passes 80.

## In one formula

In Excel for Microsoft 365, SCAN returns the whole running total as a spill:

`=SCAN(0, B2:B13, LAMBDA(total, amount, total + amount))`

SCAN starts at 0 and adds each amount in turn. The column updates when the source changes and cannot be broken by editing one cell.

## Running total by group

To restart the total for each region in column A:

`=SUMIFS($B$2:B2, $A$2:A2, A2)`

Each row adds the amounts so far that share its region. The data does not need to be sorted.

## Checks

- The last running total must equal `=SUM(B2:B13)`.
- If the totals jump or stay flat, look for text in the amount column. SUM skips it without warning.
