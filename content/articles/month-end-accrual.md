---

title: Month end accrual for part of a month
description: Accrue a cost for only the days a service ran in the month, with formulas that handle start and end dates.
updated: 2026-11-16
minutes: 4
topic: finance
functions: [MIN, MAX, EOMONTH, DAY, ROUND, NETWORKDAYS]
exercises: [month-end-accrual-for-part-of-a-month, a-monthly-close-checklist-in-formulas, days-and-simple-date-maths]
cover: "17/30 days"
---

## The situation

A contract costs 3,000 a month. It started on 14 November, and the supplier will invoice later. At month end you need to record the cost of the days already used, 17 of 30.

## Step 1: the month's first and last day

Put any date in the month in H1. Then:

- First day: `=EOMONTH($H$1, -1) + 1`
- Last day: `=EOMONTH($H$1, 0)`
- Days in the month: `=DAY(EOMONTH($H$1, 0))`

Working from H1 means next month only needs one cell changed.

## Step 2: days used this month

The service runs from the start date in B2 to the end date in C2. The days that fall in this month start at the later of the two starts and end at the earlier of the two ends:

`=MAX(0, MIN(C2, LastDay) - MAX(B2, FirstDay) + 1)`

For a start of 14 November and no end yet, this gives 30 minus 14 plus 1, so 17 days. MAX(0, ...) returns 0 for a contract that starts after or ends before the month.

If there is no end date, put a far future date in C2, or wrap it: `IF(C2="", LastDay, C2)`.

## Step 3: the accrual

`=ROUND(D2 * E2 / DaysInMonth, 2)`

D2 is the monthly fee and E2 the days used. 3,000 times 17 divided by 30 gives 1,700.00.

Round each line to two places, so the journal total matches the lines.

## Working days instead

Some contracts charge by working day. Replace the day counts with NETWORKDAYS:

- Days used: `=NETWORKDAYS(MAX(B2, FirstDay), MIN(C2, LastDay), Holidays)`
- Days in the month: `=NETWORKDAYS(FirstDay, LastDay, Holidays)`

## Reversing next month

An accrual is usually reversed on the first day of the next month, when the real invoice arrives. Keep a column with the reversal date, `=LastDay + 1`, and a column for the invoice number once it comes in.

## Checks

- A contract that ran all month should accrue exactly its monthly fee.
- The days used can never exceed the days in the month.
- Total the accrual column and compare it with the journal before posting.
