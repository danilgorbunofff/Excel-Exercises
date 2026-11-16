---

title: Rank, top N and percentile
description: Find where a value stands in a list, pull the top five, and handle ties.
updated: 2026-11-16
minutes: 4
topic: sums
functions: [RANK.EQ, LARGE, SMALL, PERCENTILE.INC, PERCENTRANK.INC, SORT, TAKE, COUNTIF]
exercises: [rank-a-list-without-sorting-it, large-and-small-the-nth-highest, median-the-middle-value]
cover: "=RANK.EQ"
---

## Rank a value

`=RANK.EQ(B2, $B$2:$B$50)` gives the position of B2 in the list, where 1 is the largest. Add a third argument of 1 to rank from the smallest instead.

Lock the list with dollar signs before you copy the formula down. Otherwise each row ranks against a shorter list.

## Ties

RANK.EQ gives tied values the same rank and skips the next one. Two people on 90 are both 2nd, and the next person is 4th.

To give every row a different rank, add a count of earlier ties:

`=RANK.EQ(B2, $B$2:$B$50) + COUNTIF($B$2:B2, B2) - 1`

The first 90 keeps rank 2 and the second becomes 3. The order between them follows the order of the rows.

## The nth largest or smallest

- `=LARGE(B2:B50, 1)` is the largest value, the same as MAX.
- `=LARGE(B2:B50, 3)` is the third largest.
- `=SMALL(B2:B50, 1)` is the smallest.

To find who holds the third largest value, look it up: `=XLOOKUP(LARGE(B2:B50, 3), B2:B50, A2:A50)`. With ties, this returns the first matching name.

## The whole top five

In Excel for Microsoft 365, sort the table and keep the first rows:

`=TAKE(SORT(A2:B50, 2, -1), 5)`

SORT orders the rows by the second column, largest first. TAKE keeps five rows. The result spills, and updates when the data changes.

## Percentiles

- `=PERCENTILE.INC(B2:B50, 0.9)` returns the value that 90 percent of the list is at or below.
- `=PERCENTRANK.INC($B$2:$B$50, B2)` returns where B2 stands, as a share from 0 to 1.
- `=MEDIAN(B2:B50)` is the 50th percentile, the middle value.

## Common mistakes

- Ranking with an unlocked range, so lower rows rank against fewer values.
- Ranking numbers stored as text. RANK.EQ leaves them out of the list, and ranking one of them returns an error.
- Reading rank 1 as the smallest. By default it is the largest.
