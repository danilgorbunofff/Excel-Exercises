---

title: Date maths with DATEDIF, EDATE and EOMONTH
description: Work out ages, tenures, due dates and month ends without counting days by hand.
updated: 2026-11-16
minutes: 4
functions: [DATEDIF, EDATE, EOMONTH, DAYS, YEARFRAC, TODAY]
exercises: [datedif-days-months-or-years-between, days-and-simple-date-maths, days-overdue-on-open-invoices]
cover: "=EOMONTH"
---

## Days between two dates

Subtract them: `=B2-A2`. `=DAYS(B2, A2)` gives the same answer, with the end date first.

Neither counts the start day. From 1 to 3 March is 2 days. Add 1 if both ends should count.

## Whole years or months: DATEDIF

`=DATEDIF(A2, B2, "y")` returns the number of complete years between two dates. It is the usual formula for an age or a length of service.

The last argument sets the unit:

- `"y"` complete years.
- `"m"` complete months.
- `"d"` days.
- `"ym"` months left over after the whole years.
- `"yd"` days left over after the whole years.

Together, `=DATEDIF(A2, B2, "y")&" years, "&DATEDIF(A2, B2, "ym")&" months"` gives "4 years, 7 months".

DATEDIF does not appear in the function list, but it works in every version. The start date must come first, or it returns `#NUM!`. Microsoft warns that the `"md"` unit can return wrong results, so avoid it.

## Years as a decimal: YEARFRAC

`=YEARFRAC(A2, B2)` returns the years between two dates with a fraction, such as 4.58. Use it for pro-rata amounts, not for ages.

## Months ahead or back: EDATE

`=EDATE(A2, 3)` returns the same day three months later. `=EDATE(A2, -1)` goes one month back.

EDATE handles short months. One month after 31 January is 28 or 29 February, not 3 March.

Use it for renewal dates, contract ends and payment schedules.

## Month ends: EOMONTH

`=EOMONTH(A2, 0)` returns the last day of A2's month. Change the 0 to move:

- `=EOMONTH(A2, -1)` is the last day of the month before.
- `=EOMONTH(A2, -1) + 1` is the first day of A2's month.
- `=EOMONTH(A2, 2)` is the last day of the month two months later, the end of a quarter that starts in A2's month.

Use it for month-end reports, SUMIFS date ranges and invoices due at the end of next month.

## Days until or since today

`=A2-TODAY()` gives the days until A2, and `=TODAY()-A2` gives the days since. TODAY changes every day, so for a report you send, put the report date in a cell and use that.

## Common mistakes

- Swapping the start and end in DATEDIF.
- Showing a day count in date format, so 45 shows as 14/02/1900. Format the cell as General or Number.
- Adding 30 days when you mean one month. Use EDATE.
