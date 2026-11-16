---

title: "Join text: TEXTJOIN, CONCAT and &"
description: Put text from several cells into one, with spaces, separators and formatted numbers.
updated: 2026-11-16
minutes: 3
functions: [TEXTJOIN, CONCAT, CONCATENATE, TEXT]
exercises: [concat-and-the-operator, textjoin-join-a-range-and-skip-blanks, upper-lower-and-proper]
cover: "=A2&\" \"&B2"
---

## The & operator

`=A2&" "&B2` joins the first name in A2 and the last name in B2 with a space between them. Anything in quotes is added as it is written.

It works in every version and is the quickest way to join two or three cells.

## CONCAT

`=CONCAT(A2, " ", B2)` does the same as `&`. It also takes ranges, so `=CONCAT(A2:D2)` joins four cells with no separator.

CONCATENATE is the older name. It still works, but it does not accept ranges.

## TEXTJOIN: a separator and no gaps

TEXTJOIN puts a separator between every item, and can skip empty cells:

`=TEXTJOIN(", ", TRUE, A2:D2)`

The first argument is the separator. TRUE skips blanks, so you never get two commas in a row. This is the best choice for addresses and lists.

CONCAT and TEXTJOIN need Excel 2019 or later.

## Numbers and dates lose their format

A date in B2 shows as 16/11/2026, but `="Due "&B2` gives "Due 46342". Joining uses the stored value, not what the cell shows.

Format the value with TEXT as you join it:

- `="Due "&TEXT(B2, "dd mmm yyyy")` gives "Due 16 Nov 2026".
- `="Total "&TEXT(C2, "#,##0.00")` gives "Total 1,250.00".
- `=TEXT(D2, "0%")&" of target"` gives "85% of target".

## A line break inside the cell

`=A2&CHAR(10)&B2` puts B2 on a new line in Windows Excel. Turn on Wrap Text for the cell, or the break does not show.

## Joining as a key

Joining two columns makes a single key for lookups, such as `=A2&"|"&B2`. Keep a separator in the key so that "AB" and "C" cannot match "A" and "BC".

## Common mistakes

- Forgetting the space, so names come out as "JohnSmith".
- Joining dates or currency without TEXT.
- Splitting the result again later. Keep the parts in their own columns and join only for display.
