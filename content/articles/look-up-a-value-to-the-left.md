---

title: How to look up a value to the left
description: VLOOKUP can only return columns to the right of the one it searches. Here are the two clean ways around that.
updated: 2026-11-16
minutes: 3
functions: [VLOOKUP, XLOOKUP, INDEX, MATCH]
exercises: [index-match, find-a-code, find-a-price]
cover: "A <- D"
---

## The problem

Say column A holds customer names and column D holds customer IDs. You know an ID and want the name. VLOOKUP cannot do this, because it searches the first column of its range and only returns columns to the right of it.

## With XLOOKUP

XLOOKUP takes the column to search and the column to return as two separate ranges, so their order does not matter:

`=XLOOKUP(H2, D2:D50, A2:A50)`

This finds H2 in column D and returns the name from column A on the same row. It works in Excel for Microsoft 365 and Excel 2021 or later.

## With INDEX and MATCH

In any version of Excel, use INDEX and MATCH:

`=INDEX(A2:A50, MATCH(H2, D2:D50, 0))`

MATCH finds the row in column D that holds H2. INDEX returns column A from that row. Keep the final 0 in MATCH, which asks for an exact match. Read [INDEX and MATCH](/articles/index-and-match/) for how the pair works.

## What not to do

You may find two other fixes online:

- Moving the ID column to the left of the names. This works until someone sorts or rebuilds the sheet, and it changes a layout other people may rely on.
- Building a swapped table inside VLOOKUP with CHOOSE. It works, but it is hard to read and easy to break.

Both XLOOKUP and INDEX with MATCH are shorter, faster to check and survive inserted columns.
