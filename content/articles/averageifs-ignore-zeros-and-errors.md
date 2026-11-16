---

title: AVERAGEIFS, and how to ignore zeros and errors
description: Average only the rows you mean, and keep zeros, blanks and errors out of the result.
updated: 2026-11-16
minutes: 3
topic: sums
functions: [AVERAGEIFS, AVERAGEIF, AVERAGE, AGGREGATE, IFERROR]
exercises: [average-score, average-functions-summary, aggregate-a-total-that-can-skip]
cover: "=AVERAGEIFS"
---

## Averages with a condition

AVERAGEIFS works like SUMIFS. The range to average comes first, then pairs of a range and a condition:

`=AVERAGEIFS(C2:C100, A2:A100, "North", B2:B100, ">="&DATE(2026,1,1))`

This averages column C for North rows dated in 2026 or later. If no row passes, the result is `#DIV/0!`.

## What AVERAGE already skips

AVERAGE leaves out empty cells and text. It does count zeros. So a month with no sales typed as 0 pulls the average down, while the same month left empty does not.

Decide which one you mean. A real zero, such as a shop that was open and sold nothing, belongs in the average.

## Ignoring zeros

Add a condition that the value is not zero:

`=AVERAGEIF(C2:C100, "<>0")`

With other conditions, add it as one more pair in AVERAGEIFS:

`=AVERAGEIFS(C2:C100, A2:A100, "North", C2:C100, "<>0")`

## Ignoring errors

One `#N/A` in the range makes AVERAGE return `#N/A`. AGGREGATE can skip errors:

`=AGGREGATE(1, 6, C2:C100)`

The 1 asks for an average and the 6 tells it to ignore error values. Function 1 also skips rows hidden by a filter if you use option 7 instead, which ignores hidden rows and errors together.

Before you skip errors, find out why they are there. An error often points to a real problem in the data.

## When there is nothing to average

Wrap the formula to show a clear message instead of `#DIV/0!`:

`=IFERROR(AVERAGEIFS(C2:C100, A2:A100, F1), "No data")`

## A note on averaging averages

If each row is already an average, such as a store's average sale, a plain average treats a small store like a big one. Weight each row by its count instead. Read [weighted average in Excel](/articles/weighted-average/) for how.
