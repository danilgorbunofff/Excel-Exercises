---

title: Fiscal year and quarter formulas
description: Label each date with its financial year and quarter when the year does not start in January.
updated: 2026-11-16
minutes: 3
topic: dates
functions: [YEAR, MONTH, EDATE, ROUNDUP, EOMONTH]
exercises: [quarter-forecast-against-budget, year-to-date-actual-against-budget, year-on-year-revenue-growth]
cover: "FY27 Q2"
---

## Calendar quarters first

`=ROUNDUP(MONTH(A2)/3, 0)` returns 1 for January to March, 2 for April to June, and so on. Join it to the year for a label:

`="Q"&ROUNDUP(MONTH(A2)/3, 0)&" "&YEAR(A2)` gives "Q2 2026".

## The trick: shift the date

A financial year is a calendar year moved by some months. Move the date by the same amount with EDATE, then use the calendar formulas.

For a year that starts in April and is named after the year it ends in, add 9 months:

- Fiscal year: `=YEAR(EDATE(A2, 9))`
- Fiscal quarter: `=ROUNDUP(MONTH(EDATE(A2, 9))/3, 0)`

A date in May 2026 moves to February 2027, so it falls in FY2027, quarter 1. A date in March 2026 moves to December 2026, so it falls in FY2026, quarter 4.

## Finding the shift

If the year starts in month S and is named after the year it ends in, shift by 13 minus S months:

- Starts in April: 9 months.
- Starts in July: 6 months.
- Starts in October: 3 months.

If the year is named after the year it starts in, shift back instead, by S minus 1 months. For a July start, use `=YEAR(EDATE(A2, -6))`.

Check which naming your company uses. Both are common.

## A full label

`="FY"&RIGHT(YEAR(EDATE(A2, 9)), 2)&" Q"&ROUNDUP(MONTH(EDATE(A2, 9))/3, 0)`

This returns labels such as "FY27 Q1". Put it in a helper column, then total by label with SUMIFS or a PivotTable.

## Start and end of the fiscal year

For an April start, the fiscal year that holds A2 begins on:

`=DATE(YEAR(EDATE(A2, 9)) - 1, 4, 1)`

and ends on `=EOMONTH(DATE(YEAR(EDATE(A2, 9)), 3, 1), 0)`, which is 31 March. Use these two dates as limits for a year-to-date SUMIFS.

## Checks

- Test the months on each side of the year start, such as 31 March and 1 April.
- Keep the shift in one cell, such as $H$1, so a change of year start is one edit.
