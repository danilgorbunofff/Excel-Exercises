---

title: Stock days of cover and reorder flags
description: Work out how long stock will last, when to reorder and how much to order, with one row per product.
updated: 2026-11-16
minutes: 4
topic: finance
functions: [IF, IFERROR, MAX, ROUNDUP, SUMIFS]
exercises: [stock-days-of-cover-and-reorder-flag, an-inventory-reorder-report, sumif-a-sum-range-on-another-column]
cover: "Days cover"
---

Days of cover is stock on hand divided by daily usage. Reorder when stock on hand plus units on order falls to the reorder point.

## The columns

Each row is a product. You need the stock on hand, the units sold over a recent period, the supplier's lead time in days, and units already on order.

## Daily usage

Divide recent sales by the number of days they cover:

`=C2/30`

where C2 holds the units sold in the last 30 days. If sales come from a transaction list, total them with SUMIFS and a date limit.

## Days of cover

`=IFERROR(B2/D2, "No sales")`

Stock of 120 and usage of 4 a day gives 30 days of cover. IFERROR catches products with no sales, which would otherwise show `#DIV/0!`.

## Reorder point

Stock should be reordered while there is still enough to last until the delivery arrives, plus a buffer:

`=D2*E2 + F2`

D2 is daily usage, E2 the lead time in days and F2 the safety stock. With usage of 4, a lead time of 10 days and safety stock of 20, the reorder point is 60 units.

## The flag

Count stock already on order, since it will arrive:

`=IF(B2 + G2 <= H2, "Reorder", "")`

B2 is stock on hand, G2 units on order and H2 the reorder point.

## How much to order

Order enough to cover a target number of days, then round up to full cases:

`=MAX(0, ROUNDUP((D2*$K$1 - B2 - G2) / I2, 0) * I2)`

K1 holds the target days of cover and I2 the case size. MAX stops a negative order when stock is already high.

## Odd data

- New products have no sales history. Give them a planned usage, or flag them for review.
- Products with very low sales give huge days of cover. Show "Over 365" past a limit, so they do not dominate a chart.
- Lumpy sales, such as one big order, distort a 30-day average. A longer period, or the median of weekly sales, is steadier.

## Checks

- Sort by days of cover, lowest first. The reorder flags should all sit near the top.
- Pick one product and work it through by hand once.
