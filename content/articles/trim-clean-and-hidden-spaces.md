---

title: TRIM, CLEAN and hidden spaces
description: Why two cells that look the same do not match, and how to find and remove what you cannot see.
updated: 2026-11-16
minutes: 4
topic: text
functions: [TRIM, CLEAN, SUBSTITUTE, LEN, CODE, EXACT]
exercises: [clean-up-an-imported-list, clean-a-product-code-then-look-it-up, substitute-replace-one-piece-of-text]
cover: "=TRIM(A2)"
---

## The symptom

A lookup returns `#N/A`, or COUNTIF counts 0, although you can see the value in the list. Data from other systems, web pages and PDFs often carries characters you cannot see. `=TRIM(CLEAN(SUBSTITUTE(A2, CHAR(160), " ")))` removes the usual three: extra spaces, control characters and non-breaking spaces.

## Find out what is there

Compare the lengths of the two cells:

`=LEN(A2)` and `=LEN(D5)`

If "B-204" has a length of 6, something besides the five visible characters is in the cell.

To see which character it is, check the first and last ones:

- `=CODE(LEFT(A2, 1))` returns the code of the first character.
- `=CODE(RIGHT(A2, 1))` returns the code of the last one.

A normal space is 32. A non-breaking space is 160. Codes below 32, such as 10 for a line break, are control characters.

## TRIM: extra spaces

`=TRIM(A2)` removes spaces at the start and end, and turns runs of spaces in the middle into single spaces. It only removes the normal space, code 32.

## CLEAN: control characters

`=CLEAN(A2)` removes control characters, codes 0 to 31. These include line breaks and tabs from exported data. It does not remove spaces.

## SUBSTITUTE: everything else

The non-breaking space, code 160, survives both TRIM and CLEAN. Swap it for a normal space first, then trim:

`=TRIM(SUBSTITUTE(A2, CHAR(160), " "))`

To deal with all three problems at once:

`=TRIM(CLEAN(SUBSTITUTE(A2, CHAR(160), " ")))`

## Fixing the column for good

1. Add a helper column with the cleaning formula.
2. Copy the helper column.
3. Paste it over the original with Paste Special > Values.
4. Delete the helper column.

If the data is reloaded every month, keep the formula instead, or clean it in Power Query, which repeats the steps on each refresh.

## Checking a match exactly

`=A2=D5` ignores case. `=EXACT(A2, D5)` also compares case, and returns FALSE if any character differs. Use it to confirm that two cleaned values are the same.

## Common mistakes

- Trimming the search value but not the table, or the other way round.
- Expecting TRIM to remove the non-breaking space.
- Cleaning a column of numbers stored as text, which leaves them as text. Read [numbers stored as text](/articles/numbers-stored-as-text/) for the next step.
