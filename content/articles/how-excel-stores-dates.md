---

title: How Excel stores dates and times
description: A date is a whole number and a time is a fraction. Knowing this explains most date problems.
updated: 2026-11-16
minutes: 4
topic: dates
functions: [DATE, DATEVALUE, TODAY, NOW, YEAR, MONTH, DAY, INT]
exercises: [date-build-a-date-from-parts, days-and-simple-date-maths, datedif-days-months-or-years-between]
cover: "46342"
---

## A date is a number

Excel stores each date as the number of days since the start of 1900. 1 January 1900 is 1, and 16 November 2026 is 46342. The date you see is only the cell's format.

To check, format a date cell as General. It shows the number underneath.

## A time is a fraction

A time is a fraction of a day. 12:00 is 0.5, 06:00 is 0.25 and 18:00 is 0.75. A date with a time is a whole number plus a fraction, so 16 November 2026 at noon is 46342.5.

## Why this helps

Because dates are numbers, ordinary maths works on them:

- `=B2-A2` gives the days between two dates.
- `=A2+30` gives the date 30 days later.
- `=A2<TODAY()` is TRUE when A2 is in the past.
- `=(B2-A2)*24` gives the hours between two date-times.

## Building and taking apart dates

- `=DATE(2026, 11, 16)` builds a date from a year, month and day.
- `=YEAR(A2)`, `=MONTH(A2)` and `=DAY(A2)` take it apart.
- `=INT(A2)` drops the time and keeps the date.
- `=TODAY()` returns today's date, and `=NOW()` returns the date and time. Both update whenever the sheet recalculates.

DATE also fixes overflow for you. `=DATE(2026, 13, 1)` returns 1 January 2027.

## Dates stored as text

A date that sits on the left of the cell is probably text. It will not sort, filter or calculate as a date.

- `=ISNUMBER(A2)` returns FALSE for a text date.
- `=DATEVALUE(A2)` converts text to a date. It reads the text using your regional settings, so 03/04/2026 can become 3 April or 4 March.
- Text to Columns on the Data tab lets you state the order, such as DMY, in its last step.

The safest fix is to build the date from its parts with DATE, LEFT, MID and RIGHT, so the order is never guessed.

## Two quirks worth knowing

Excel counts 29 February 1900 as a real day, although 1900 was not a leap year. This was kept to match an older spreadsheet program. It only affects dates before March 1900.

Some workbooks use the 1904 date system, which counts from 1904 instead. Copying dates between such a file and a normal one shifts them by four years and a day.

## Common mistakes

- Comparing a date with text, such as `A2>"1/1/2026"`. Compare with `DATE(2026,1,1)` instead.
- Expecting a date-time to equal a date. `A2=DATE(2026,11,16)` is FALSE if A2 holds a time as well. Use `INT(A2)`.
