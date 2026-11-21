---

title: Weighted average in Excel
description: When a plain average gives the wrong answer, and the one formula that fixes it.
updated: 2026-11-16
minutes: 3
topic: sums
functions: [SUMPRODUCT, SUM, AVERAGE, SUMIFS]
exercises: [weighted-average-unit-cost, sumproduct-multiply-then-add, average-score]
cover: "=SUMPRODUCT"
---

## Why a plain average misleads

You bought stock three times: 100 units at 2.00, 10 units at 5.00 and 10 units at 5.00. AVERAGE of the three prices is 4.00. But most of the units cost 2.00, so the real average cost per unit is far lower.

A weighted average gives each price a weight, here the number of units.

## The formula

Multiply each value by its weight, add those up, then divide by the total weight:

`=SUMPRODUCT(B2:B4, C2:C4) / SUM(C2:C4)`

With prices in B2:B4 and units in C2:C4, this gives (200 + 50 + 50) / 120 = 2.50 per unit.

SUMPRODUCT multiplies the two columns row by row and adds the results. Both ranges must be the same size.

## Common uses

- Average unit cost, weighted by quantity.
- Average price, weighted by units sold.
- Average interest rate across loans, weighted by balance.
- Course grade, where coursework counts 40 percent and the exam 60 percent.

For grades, the weights already add up to 100 percent, so `=SUMPRODUCT(B2:B3, C2:C3)` is enough. Dividing by SUM of the weights does no harm, and it still gives the right answer if the weights do not add up to 100 percent.

## With a condition

To get the weighted average for one product only, use SUMPRODUCT with a test, and SUMIFS for the weights:

`=SUMPRODUCT((A2:A100="Widget")*B2:B100*C2:C100) / SUMIFS(C2:C100, A2:A100, "Widget")`

## Averaging percentages

The same trap applies to rates. If one store converts 50 percent of 10 visitors and another 10 percent of 1,000, the combined rate is not 30 percent. Add up the conversions and divide by the total visitors, which gives about 10.4 percent.

## Checks

- The weighted average must sit between the smallest and largest value. If not, a range is misaligned.
- If every weight is equal, the result must match AVERAGE.
