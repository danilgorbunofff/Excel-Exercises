---

title: Clean a product code column, step by step
description: Turn messy codes from several systems into one format that lookups can match.
updated: 2026-11-16
minutes: 4
topic: text
functions: [TRIM, UPPER, SUBSTITUTE, RIGHT, LEN, XLOOKUP, COUNTIF]
exercises: [clean-a-product-code-then-look-it-up, upper-lower-and-proper, clean-up-an-imported-list]
cover: "ab-12 > AB12"
---

## The problem

The price list holds codes like AB0012. The order export holds " ab-12", "AB 0012" and "ab0012". A lookup sees four different values and finds none of them.

The fix is to agree on one format, then convert both lists to it. Here the target is two capital letters followed by four digits.

## Step 1: remove spaces

`=TRIM(SUBSTITUTE(A2, CHAR(160), " "))`

This removes spaces at both ends, including the non-breaking spaces that TRIM misses on its own.

## Step 2: one case

`=UPPER(B2)`

Lookups ignore case, but other tools and people do not. One case keeps the column consistent.

## Step 3: remove separators

`=SUBSTITUTE(SUBSTITUTE(C2, "-", ""), " ", "")`

This removes hyphens and the spaces inside the code. "AB-12" becomes "AB12".

## Step 4: pad the number

Split the letters from the digits, then pad the digits to four places:

`=LEFT(D2, 2)&RIGHT("0000"&MID(D2, 3, 10), 4)`

MID takes everything after the two letters. Adding four zeros in front and keeping the last four characters turns "12" into "0012". "AB12" becomes "AB0012".

## Step 5: check the result

- `=LEN(E2)=6` should be TRUE on every row.
- `=COUNTIF(PriceList[Code], E2)` should be 1. A 0 means the code is not in the price list. A 2 means the price list has a duplicate.

Filter for the rows that fail and look at them by hand. They are often a real typo, not a format problem.

## Step 6: look it up

`=XLOOKUP(E2, PriceList[Code], PriceList[Price], "Check code")`

## One formula or several columns

You can nest all the steps into one formula, but separate columns are easier to check and fix. Once the steps work, you can hide the helper columns or combine them.

If the export arrives every month, clean it in Power Query instead. It records each step and repeats them on every refresh.

## Common mistakes

- Cleaning only one of the two lists.
- Turning codes into numbers, which drops leading zeros.
- Skipping the check, so a few codes that still do not match go unnoticed.
