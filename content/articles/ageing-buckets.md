---

title: Ageing buckets for receivables
description: Sort open invoices into bands by days overdue, then total each band and check it against the ledger.
updated: 2026-11-16
minutes: 4
topic: dates
functions: [XLOOKUP, SUMIFS, COUNTIFS, MAX, IFS]
exercises: [ageing-buckets-for-receivables, days-overdue-on-open-invoices, delivery-band]
cover: "0-30 31-60"
---

## What an ageing report shows

An aged receivables report groups unpaid invoices by how late they are. Finance teams use it to see which customers to chase and how much may not be paid. Typical bands are not yet due, 1 to 30 days, 31 to 60, 61 to 90 and over 90.

## Step 1: fix the report date

Put the report date in one cell, such as $H$1. Avoid TODAY in the formulas. A report sent on the 5th should still give the same numbers when it is opened on the 20th.

## Step 2: days overdue

With the due date in C2:

`=MAX(0, $H$1 - C2)`

An invoice not yet due gives 0. MAX stops it from showing negative days.

## Step 3: the band

Make a small band table, sorted from low to high:

- 0, Not due
- 1, 1-30
- 31, 31-60
- 61, 61-90
- 91, Over 90

With the starting days in K2:K6 and the labels in L2:L6:

`=XLOOKUP(D2, $K$2:$K$6, $L$2:$L$6, , -1)`

The `-1` finds the largest start that is not above the days overdue. 45 days finds 31, so the band is 31-60. A table is easier to change than a nested IF.

## Step 4: totals per band

`=SUMIFS(Amount, Band, "31-60")` totals one band. Add a customer condition to build the usual grid of customers by bands:

`=SUMIFS(Amount, Customer, $A10, Band, B$9)`

The mixed references let one formula fill the whole grid.

## Step 5: check against the ledger

The total of all bands must equal the receivables balance in the ledger. Put the check in a cell:

`=ROUND(SUM(B10:F30) - LedgerBalance, 2) = 0`

If it is FALSE, look for invoices with no due date, credit notes or amounts stored as text.

## Things to decide

- Age from the due date or the invoice date. Both are used. State which in the report title.
- Treat credit notes and unapplied cash as their own lines, or they hide old debt.
- Show the percentage of the total in each band, so you can compare months.
