---

title: "Variance to budget: the formulas finance teams use"
description: Work out the variance in money and percent, show whether it is good or bad, and flag the lines worth explaining.
updated: 2026-11-16
minutes: 4
functions: [IF, ABS, AND, IFERROR, SUMIFS]
exercises: [variance-to-budget-by-cost-centre, budget-versus-actual-with-a-variance-flag, year-to-date-actual-against-budget]
cover: "=B2-C2"
---

## The layout

Each row is a cost centre or account. Column B holds the actual and column C the budget. The variance goes in D and the variance percent in E.

## Variance in money

`=B2-C2`

Actual minus budget is the most common convention. A positive number means you spent or earned more than planned. State the convention in the column heading, because some teams use budget minus actual.

## Variance in percent

`=IFERROR((B2-C2)/ABS(C2), "")`

Dividing by ABS of the budget keeps the sign right when the budget is negative, such as a planned loss. IFERROR covers lines with no budget, where the division would give `#DIV/0!`.

Format the column as a percentage with one decimal place.

## Good or bad

Whether a positive variance is good depends on the line. More revenue than budget is favourable. More cost than budget is adverse.

Put the type of each line, Revenue or Cost, in column F, then:

`=IF(B2=C2, "", IF((B2>C2)=(F2="Revenue"), "Fav", "Adv"))`

Over budget on revenue gives Fav. Over budget on cost gives Adv.

## Flag what needs explaining

Small lines can swing by a large percent and big lines can move a lot of money at a small percent. Flag a line only when it passes both limits:

`=IF(AND(ABS(B2-C2)>=$H$1, ABS(E2)>=$H$2), "Explain", "")`

Keep the money limit in H1 and the percent limit in H2, so the rule is visible and easy to change.

## Pulling actuals from the ledger

If the actuals sit in a transaction list, total each cost centre with SUMIFS:

`=SUMIFS(Ledger[Amount], Ledger[CostCentre], $A2, Ledger[Month], "<="&$H$3)`

H3 holds the last closed month, so the same sheet gives month or year-to-date figures.

## Checks

- The total variance must equal total actual minus total budget.
- Sum the percent column only as a check that nothing is wildly wrong. Percent variances do not add up across lines. Work out the total percent from the totals.
