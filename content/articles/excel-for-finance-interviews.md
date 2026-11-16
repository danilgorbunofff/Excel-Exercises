---

title: "Excel for finance interviews: 10 formulas to know"
description: The functions finance, FP&A and accounting interviews test most, with the trap in each one.
updated: 2026-11-16
minutes: 5
topic: interviews
functions: [SUMIFS, XLOOKUP, INDEX, MATCH, IF, IFERROR, SUMPRODUCT, EOMONTH, ROUND, NPV, XNPV, IRR, XIRR, PMT]
exercises: [variance-to-budget-by-cost-centre, year-on-year-revenue-growth, weighted-average-unit-cost]
cover: "=XNPV"
---

## What finance interviews look for

Finance tasks are less about rare functions and more about getting standard ones right on messy data. Expect to total, look up, compare periods and check that numbers tie out.

## 1. SUMIFS

Totals by account, cost centre and period. The trap: the sum range comes first in SUMIFS but last in SUMIF.

## 2. XLOOKUP or INDEX and MATCH

Pulling balances from a trial balance or rates from a table. The trap: forgetting the exact match, so a missing account returns a neighbour's balance.

## 3. IF with AND and OR

Flags such as "over budget by more than 10 percent and 5,000". The trap: using a percent limit alone, which flags tiny lines.

## 4. IFERROR

Clean output when a budget is zero or an account is missing. The trap: hiding errors that point to real data problems. Use it only around the step that can fail.

## 5. SUMPRODUCT

Weighted averages, such as cost per unit or rate on a loan book. The trap: averaging rates directly instead of weighting them.

## 6. EOMONTH and EDATE

Month ends, period limits for SUMIFS and payment schedules. The trap: adding 30 days when you mean one month.

## 7. ROUND

Two decimal places on money, and checks that compare totals. The trap: comparing unrounded totals, which can differ by a tiny fraction.

## 8. NPV and XNPV

The value today of future cash flows. NPV assumes the first cash flow comes one period from now, so add the time-zero amount outside it:

`=C2 + NPV(rate, C3:C7)`

XNPV takes real dates and is better when payments are not evenly spaced.

## 9. IRR and XIRR

The rate at which the value of the cash flows is zero. XIRR takes dates, like XNPV. The trap: cash flows with the wrong sign. The investment must be negative and the returns positive.

## 10. PMT

The regular payment on a loan:

`=PMT(5%/12, 60, 20000)`

This returns the monthly payment on 20,000 over five years at 5 percent a year. The trap: mixing a yearly rate with monthly periods. Divide the rate by 12 when the periods are months. The result is negative because it is money going out.

## Beyond formulas

Interviewers also watch how you build: inputs in labelled cells, no typed numbers inside formulas, and a check that the output ties back to the source. A model that is easy to audit often scores better than a clever one.
