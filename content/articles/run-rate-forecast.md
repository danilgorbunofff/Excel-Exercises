---

title: Full year forecast from the run rate
description: Three ways to project a full year from the months you have, and when each one misleads.
updated: 2026-11-16
minutes: 4
functions: [SUM, COUNT, AVERAGE]
exercises: [full-year-forecast-from-the-run-rate, quarter-forecast-against-budget, year-on-year-revenue-growth]
cover: "YTD/9*12"
---

## The question

Nine months of actuals are in. Leadership wants to know where the full year will land. The quickest answer is a run rate: assume the rest of the year looks like the part you have seen.

The examples assume the twelve months sit in B2:M2, with future months left empty.

## Method 1: year to date, scaled up

`=SUM(B2:M2) / COUNT(B2:M2) * 12`

COUNT counts only the months that hold a number, so the formula works whichever month you are in. With 9 months totalling 450, it gives 450 / 9 * 12 = 600.

Leave future months empty, not zero. A zero counts as a month and drags the forecast down.

## Method 2: recent months

If the business is growing, early months understate the run rate. Use the average of the last three months for the months that are left:

`=SUM(B2:J2) + AVERAGE(H2:J2) * 3`

With actuals for January to September in B2:J2, this adds the average of July to September for each of the three months left. Move the AVERAGE range along as each month closes.

## Method 3: allow for seasons

Sales often follow the same shape every year. If last year's first nine months made up 70 percent of the year, scale this year's actuals the same way:

`=SUM(B2:J2) / (SUM(B3:J3) / SUM(B3:M3))`

Row 3 holds last year. With 450 this year and 70 percent last year, the forecast is 450 / 0.7 = 643.

## Which one to use

- Steady business: method 1.
- Clear growth or decline: method 2.
- Strong seasons, such as retail before the holidays: method 3.

Show two of them side by side. If they differ a lot, the gap is worth explaining.

## Comparing with budget

Put the forecast next to the full-year budget, with the variance in money and percent. Read [variance to budget](/articles/variance-to-budget/) for those formulas.

## Things to watch

- One-off items, such as a large refund or a big order, distort the run rate. Take them out, forecast, then add them back.
- A month that is not fully closed should not count as actual yet.
- Label the forecast with the method and the last month of actuals.
