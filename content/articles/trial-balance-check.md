---

title: Build a trial balance check
description: Prove that debits equal credits, every account is mapped, and the report lines add back to the ledger.
updated: 2026-11-16
minutes: 4
functions: [SUM, ROUND, SUMIFS, XLOOKUP, COUNTIF, IF]
exercises: [trial-balance-lookup-and-check, a-monthly-close-checklist-in-formulas, department-cost-roll-up]
cover: "Dr = Cr"
---

## What the check proves

A trial balance lists every account with its balance at the period end. Before it feeds a report, three things must hold: it balances, every account is mapped to a report line, and the report adds back to the trial balance.

## Check 1: debits equal credits

With debits in C2:C300 and credits in D2:D300:

`=ROUND(SUM(C2:C300) - SUM(D2:D300), 2) = 0`

If the ledger exports one signed column instead, debits positive and credits negative, the column must sum to zero:

`=ROUND(SUM(E2:E300), 2) = 0`

ROUND matters. Totals of many decimal amounts can differ by a tiny fraction and show FALSE for no real reason.

## Check 2: every account is mapped

A mapping table links each account number to a report line, such as Revenue or Staff costs. Look up each account:

`=XLOOKUP(A2, Map[Account], Map[Line], "UNMAPPED")`

Then count the gaps:

`=COUNTIF(F2:F300, "UNMAPPED")`

This must be 0. New accounts opened during the year are the usual cause.

## Check 3: the report adds back

Build each report line with SUMIFS over the mapped column:

`=SUMIFS($E$2:$E$300, $F$2:$F$300, "Revenue")`

The report lines together must equal the trial balance total:

`=ROUND(SUM(ReportLines) - SUM(E2:E300), 2) = 0`

If this fails while check 2 passes, a line name in the report does not match the mapping exactly.

## Check 4: no duplicates

`=COUNTIF($A$2:$A$300, A2)` on each row should be 1. A duplicate account doubles its balance in the report.

## One status cell

Collect the checks in one place:

`=IF(AND(Check1, Check2, Check3, Check4), "OK", "Check")`

Put it at the top of the sheet in a cell everyone sees. Conditional formatting can turn it red when it reads Check.

## Common mistakes

- A sign flipped on credits in one place, so revenue shows as a cost.
- Mapping by account name instead of number. Names get renamed, numbers do not.
- Fixed ranges such as E2:E300 that miss new accounts. Use an Excel table.
