---

title: Bank reconciliation in Excel
description: Match the bank statement to the cash book with formulas, find what is left over, and prove the balances agree.
updated: 2026-11-16
minutes: 5
topic: finance
functions: [COUNTIFS, SUMIFS, XLOOKUP, ROUND, IF]
exercises: [bank-reconciliation-match, a-monthly-close-checklist-in-formulas, countifs-several-conditions]
cover: "Bank = Book"
---

## What you are proving

The balance on the bank statement and the cash balance in your books should differ only by items one side has and the other does not yet have. A reconciliation lists those items and shows that they explain the whole gap.

## Step 1: two lists side by side

Put the bank statement lines on one sheet and the cash book lines on another. Each needs a date, a reference and an amount, with money out as negative on both.

Turn each list into an Excel table, such as Bank and Book. Formulas then refer to columns by name.

## Step 2: match on amount and date

In the Book table, add a column that counts matching bank lines:

`=COUNTIFS(Bank[Amount], [@Amount], Bank[Date], [@Date])`

1 means a match. 0 means the bank has no such line yet. 2 or more means the same amount and date appear twice, and you need the reference to tell them apart.

Add the same column to the Bank table, pointing at Book.

## Step 3: allow for a few days

Cheques and transfers often clear a day or two after you record them. Widen the date test:

`=COUNTIFS(Bank[Amount], [@Amount], Bank[Date], ">="&[@Date], Bank[Date], "<="&[@Date]+5)`

This finds a bank line for the same amount up to five days later.

## Step 4: match on reference

If both sides carry a reference, such as an invoice or cheque number, match on that as well:

`=COUNTIFS(Bank[Ref], [@Ref], Bank[Amount], [@Amount])`

A reference match is stronger than an amount match. Use amount alone only for what is left.

## Step 5: the reconciliation

Unmatched lines in the books are usually deposits in transit and payments not yet cleared. Unmatched lines on the bank are usually fees, interest and direct debits not yet recorded.

Lay it out as:

- Balance per bank statement
- add deposits in transit
- less payments not yet cleared
- equals adjusted bank balance

Then do the same for the books with fees and interest. The two adjusted balances must agree:

`=ROUND(AdjustedBank - AdjustedBook, 2) = 0`

ROUND stops tiny decimal differences from showing a mismatch.

## Common mistakes

- Money out as negative on one side and positive on the other, so nothing matches.
- Counting a pair as matched twice when two lines share an amount and date.
- Leaving old unmatched items on the list month after month. Anything older than a month or two needs to be investigated.
