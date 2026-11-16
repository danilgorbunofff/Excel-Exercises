---

title: "Why VLOOKUP returns #N/A, and how to fix it"
description: Why a lookup finds no match when the value looks like it is there, and the fix for each cause.
updated: 2026-11-16
minutes: 5
functions: [VLOOKUP, XLOOKUP, TRIM, IFNA, VALUE]
exercises: [ifna-catch-only-a-missing-match, clean-a-product-code-then-look-it-up, find-an-extension]
cover: "#N/A?"
---

## What the error means

`#N/A` from a lookup means "no match found". Sometimes the value really is missing. More often it is there, but differs from what you searched for in a way you cannot see. Work through the causes below in order.

## 1. The value really is missing

Use Find (Ctrl+F) to search the lookup column for the value. If it is not there, the error is correct. Show a clear message instead, as described at the end.

## 2. Extra spaces

"B-204 " with a trailing space does not match "B-204". Data copied from other systems often carries leading or trailing spaces.

Test it with `=LEN(A2)` on both cells. If the lengths differ, clean the search value with TRIM:

`=VLOOKUP(TRIM(A2), D2:F20, 3, FALSE)`

If the spaces are in the table, add a helper column with `=TRIM(D2)` and look up in that instead.

## 3. Non-breaking spaces

Text pasted from web pages can contain a non-breaking space, character 160. TRIM does not remove it. Replace it first:

`=TRIM(SUBSTITUTE(A2, CHAR(160), " "))`

## 4. A number stored as text

The number 1001 and the text "1001" look the same but do not match. A green triangle in the cell corner, or numbers aligned to the left, are the usual signs.

Convert the search value to match the table:

- Table holds numbers, search value is text: `=VLOOKUP(VALUE(A2), D2:F20, 3, FALSE)`
- Table holds text, search value is a number: `=VLOOKUP(A2&"", D2:F20, 3, FALSE)`

## 5. The value is not in the first column

VLOOKUP only searches the first column of the range. If the range is B2:F20, it searches column B, even if your codes are in column D. Start the range at the column you search, or switch to XLOOKUP.

## 6. The range moved when you copied the formula

If the formula in row 2 uses D2:F20, the copy in row 10 uses D10:F28. Values above row 10 can no longer be found. Lock the range with dollar signs:

`=VLOOKUP(A2, $D$2:$F$20, 3, FALSE)`

Read [relative and absolute references](/articles/relative-and-absolute-references/) for why this happens.

## 7. Approximate match on a small value

Without FALSE at the end, a value smaller than anything in the first column returns `#N/A`. Add FALSE for codes and names. Read [approximate or exact match](/articles/approximate-or-exact-match/) for the full story.

## Showing a message instead

Once you know the remaining errors are real misses, wrap the formula in IFNA:

`=IFNA(VLOOKUP(A2, $D$2:$F$20, 3, FALSE), "Not found")`

IFNA only catches `#N/A`. IFERROR would also hide a typo in the formula, such as a bad range, so you would never see it.
