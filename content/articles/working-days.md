---

title: Working days with NETWORKDAYS and WORKDAY
description: Count business days between dates, find a date some working days ahead, and handle holidays and odd weekends.
updated: 2026-11-16
minutes: 3
functions: [NETWORKDAYS, WORKDAY, NETWORKDAYS.INTL, WORKDAY.INTL]
exercises: [days-overdue-on-open-invoices, days-and-simple-date-maths, month-end-accrual-for-part-of-a-month]
cover: "Mon-Fri"
---

## Count working days: NETWORKDAYS

`=NETWORKDAYS(A2, B2)` counts the days from A2 to B2 that fall Monday to Friday. Both the start and the end date are counted, if they are weekdays.

So from Monday to Friday of the same week is 5, while `=B2-A2` gives 4.

## Leave out holidays

List the holidays in a range, such as H2:H12, and pass it as the third argument:

`=NETWORKDAYS(A2, B2, $H$2:$H$12)`

Keep the holiday list on its own sheet or in an Excel table, and update it each year. Lock the range before you copy the formula down.

## A date some working days ahead: WORKDAY

`=WORKDAY(A2, 10, $H$2:$H$12)` returns the date ten working days after A2, skipping weekends and holidays. Use a negative number to go back.

WORKDAY does not count the start date. If A2 is a Friday, one working day later is the Monday.

Format the result as a date. Otherwise it shows as a number.

## Different weekends: the INTL versions

NETWORKDAYS.INTL and WORKDAY.INTL let you choose the weekend. The weekend is the third argument and the holidays move to the fourth:

`=NETWORKDAYS.INTL(A2, B2, 7, $H$2:$H$12)`

Common weekend codes:

- `1` Saturday and Sunday, the default.
- `7` Friday and Saturday.
- `11` Sunday only.

You can also give a seven-character text of 1s and 0s, starting on Monday, where 1 marks a day off. `"0000011"` is a normal weekend, and `"0000001"` is Sunday only.

## Typical uses

- Days an invoice is overdue, counted in business days.
- A due date ten working days after an order.
- The working days in a month, for pro-rata costs: `=NETWORKDAYS(EOMONTH(A2,-1)+1, EOMONTH(A2,0), $H$2:$H$12)`.

## Common mistakes

- Forgetting that NETWORKDAYS counts both ends, then adding 1 again.
- A holiday list that holds text dates. They are ignored without a warning.
- Holidays that fall on a weekend. These are already skipped, so they do not change the count.
