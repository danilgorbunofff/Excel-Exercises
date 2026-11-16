---

title: "Gross margin and markup: the formulas and the difference"
description: Two ways to state profit on a sale, how to convert between them, and how to total margin across products.
updated: 2026-11-16
minutes: 4
topic: finance
functions: [SUMIFS, SUMPRODUCT, IFERROR, ROUND]
exercises: [gross-margin-by-product, capstone-margin, price-after-discount]
cover: "40% / 67%"
---

## Same profit, two percentages

An item costs 60 and sells for 100. The profit is 40.

- **Margin** is profit as a share of the price: 40 / 100 = 40 percent.
- **Markup** is profit as a share of the cost: 40 / 60 = 66.7 percent.

Both describe the same sale. Mixing them up is one of the most common pricing mistakes.

## The formulas

With the price in B2 and the cost in C2:

- Gross profit: `=B2-C2`
- Gross margin: `=IFERROR((B2-C2)/B2, "")`
- Markup: `=IFERROR((B2-C2)/C2, "")`

IFERROR covers a price or cost of zero.

## Setting a price

To hit a target margin, divide the cost by one minus the margin:

`=C2/(1-E2)`

For a cost of 60 and a target margin of 40 percent, this gives 100.

To apply a markup, multiply the cost by one plus the markup:

`=C2*(1+E2)`

For a cost of 60 and a markup of 40 percent, this gives 84. The margin on that price is only 28.6 percent.

## Converting between them

- Markup from margin: `=E2/(1-E2)`. A 40 percent margin is a 66.7 percent markup.
- Margin from markup: `=E2/(1+E2)`. A 40 percent markup is a 28.6 percent margin.

## Margin across products

Do not average the margin column. A product with tiny sales would count as much as your best seller.

Add up the money first, then divide:

`=(SUM(Revenue) - SUM(Cost)) / SUM(Revenue)`

For one product line in a transaction list, use SUMIFS for both totals:

`=1 - SUMIFS(Cost, Product, "Widget") / SUMIFS(Revenue, Product, "Widget")`

## Discounts eat margin fast

A 10 percent discount on the item above cuts the price to 90. Profit falls from 40 to 30, and the margin drops from 40 to 33.3 percent. The discount took a quarter of the profit.

## Checks

- A margin can never reach 100 percent unless the cost is zero. A markup can be any size.
- A negative margin means the item sells below cost.
- Make sure cost and price are both with or both without tax.
