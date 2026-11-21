---

title: Sum by month, quarter or year
description: Three ways to total dated rows by period, from date limits in SUMIFS to a helper column.
updated: 2026-11-16
minutes: 4
topic: sums
functions: [SUMIFS, EOMONTH, DATE, SUMPRODUCT, MONTH, YEAR]
exercises: [year-to-date-actual-against-budget, quarter-forecast-against-budget, sumifs-two-conditions-at-once]
cover: "Q1 Q2 Q3 Q4"
---

To total a period, give SUMIFS two date limits: on or after the first day, and on or before the last.

## The setup

Dates sit in A2:A500 and amounts in C2:C500. You want one total per month, quarter or year. The examples assume the first day of the period is in F2.

## By month, with SUMIFS

Give SUMIFS a start and an end:

`=SUMIFS(C2:C500, A2:A500, ">="&F2, A2:A500, "<="&EOMONTH(F2, 0))`

EOMONTH(F2, 0) returns the last day of F2's month, so you never have to know whether a month has 28, 30 or 31 days.

If the dates carry times, use "less than the first of next month" instead, so the last day is counted in full:

`=SUMIFS(C2:C500, A2:A500, ">="&F2, A2:A500, "<"&EOMONTH(F2, 0)+1)`

## By quarter or year

Change how far the end date sits from the start:

- Quarter: `"<="&EOMONTH(F2, 2)` ends on the last day of the third month.
- Year: `"<="&EOMONTH(F2, 11)` ends on the last day of the twelfth month.
- Year to date: use the report date as the end.

This also works for financial years that do not start in January. Put the first day of the financial year in F2.

## With SUMPRODUCT

SUMPRODUCT can test the month directly, with no start and end dates:

`=SUMPRODUCT((YEAR(A2:A500)=2026)*(MONTH(A2:A500)=3)*C2:C500)`

This totals March 2026. It is handy for a one-off check, but slower than SUMIFS on large sheets. It returns `#VALUE!` if a date cell holds text that is not a date.

## With a helper column

Add a column that labels each row with its period:

- Month: `=TEXT(A2, "yyyy-mm")` gives 2026-03.
- Quarter: `=YEAR(A2)&" Q"&ROUNDUP(MONTH(A2)/3, 0)` gives 2026 Q1.

Then total by label with `=SUMIFS(C2:C500, D2:D500, "2026 Q1")`. A label column also makes a PivotTable or a filter quick to build.

## Checks

- Add up your monthly totals and compare with `=SUM(C2:C500)`. A gap means some dates fall outside your periods.
- Dates stored as text are skipped by SUMIFS. If a total looks low, check that the dates are aligned to the right.
