---

title: "SUBSTITUTE or REPLACE: changing part of a text"
description: SUBSTITUTE swaps text you can name. REPLACE swaps the characters at a position.
updated: 2026-11-16
minutes: 3
topic: text
functions: [SUBSTITUTE, REPLACE, FIND, SEARCH, LEN]
exercises: [substitute-replace-one-piece-of-text, clean-up-an-imported-list, text-search-summary]
cover: "=SUBSTITUTE"
---

Use SUBSTITUTE when you know the text to change, and REPLACE when you know where it sits.

## SUBSTITUTE: replace text you can name

`=SUBSTITUTE(A2, "-", "")` removes every hyphen from A2, so "AB-12-9" becomes "AB129".

The arguments are the text, what to find and what to put in its place. Make the new text "" to delete.

To change only one occurrence, give its number as a fourth argument:

`=SUBSTITUTE(A2, "-", "/", 2)` changes only the second hyphen, giving "AB-12/9".

SUBSTITUTE is case-sensitive. `=SUBSTITUTE(A2, "ltd", "Ltd")` leaves "LTD" alone.

## REPLACE: replace text at a position

`=REPLACE(A2, 1, 3, "UK")` removes three characters starting at the first, then puts UK in their place. "GBR-1042" becomes "UK-1042".

The arguments are the text, the start position, how many characters to remove and the new text.

Use REPLACE when you know where the change is, but not what is there. A typical case is masking all but the last four digits of an account number:

`=REPLACE(A2, 1, LEN(A2) - 4, "****")`

## Combining REPLACE with FIND

When the position depends on the text, let FIND work it out. This removes everything up to and including the first hyphen:

`=REPLACE(A2, 1, FIND("-", A2), "")`

Use SEARCH instead of FIND when case should not matter.

## Several replacements

Nest SUBSTITUTE to swap more than one thing:

`=SUBSTITUTE(SUBSTITUTE(A2, "-", ""), " ", "")`

This removes hyphens and spaces. Beyond three or four levels, Find and Replace (Ctrl+H) or Power Query is easier to maintain.

## Counting a character

SUBSTITUTE can also count. The number of hyphens in A2 is the length lost when you remove them:

`=LEN(A2) - LEN(SUBSTITUTE(A2, "-", ""))`

## Common mistakes

- Expecting SUBSTITUTE to ignore case.
- Using REPLACE when the text you want to change sits at a different position in each row. Use SUBSTITUTE or FIND.
- Removing a separator from a number stored as text and expecting a number. The result is still text. Wrap it in VALUE.
