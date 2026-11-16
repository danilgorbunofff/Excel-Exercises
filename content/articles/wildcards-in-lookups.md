---

title: Wildcards in lookups
description: How to find a value when you know only part of it, in VLOOKUP, XLOOKUP, MATCH and COUNTIF.
updated: 2026-11-16
minutes: 4
functions: [VLOOKUP, XLOOKUP, MATCH, COUNTIF, SUMIF]
exercises: [vlookup-with-a-wildcard, wildcards-in-text-criteria, countif-with-wildcards]
cover: "B-2??"
---

## The three characters

- `*` stands for any number of characters, including none. `"Acme*"` matches "Acme", "Acme Ltd" and "Acme Holdings".
- `?` stands for exactly one character. `"B-2??"` matches "B-204" and "B-2XL", but not "B-20".
- `~` turns the next character back into a plain character. `"5~*"` matches the text "5*" and nothing else.

## In VLOOKUP and MATCH

Both accept wildcards when they look for an exact match:

`=VLOOKUP("*"&A2&"*", D2:F50, 3, FALSE)`

This finds the first row whose code contains the text in A2 anywhere. The same pattern works in MATCH with 0 as its last argument.

## In XLOOKUP

XLOOKUP ignores wildcards unless you ask for them. Give 2 as the fifth argument:

`=XLOOKUP("*"&A2&"*", D2:D50, F2:F50, "Not found", 2)`

## In COUNTIF, SUMIF and the other IFS functions

The criteria in COUNTIF, COUNTIFS, SUMIF, SUMIFS and AVERAGEIF all accept wildcards:

`=COUNTIF(B2:B100, "*refund*")`

This counts the cells in B2:B100 that contain "refund" anywhere, in any case.

## Things to watch

- Only the first match comes back. If "Acme" appears in three names, you get the highest one in the list. Check with COUNTIF how many rows match before you trust the result.
- Wildcards only match text. A number such as 1042 is not matched by `"10*"` unless it is stored as text.
- Matching ignores case, so "ACME" and "acme" are the same.
- If your data contains a real `*` or `?`, put `~` before it in the search value. Otherwise Excel reads it as a wildcard.
