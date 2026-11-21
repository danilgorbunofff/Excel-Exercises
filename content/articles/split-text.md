---

title: "Split text: TEXTSPLIT, TEXTBEFORE or LEFT and MID"
description: Break one cell into parts with a formula, in current Excel and in older versions.
updated: 2026-11-16
minutes: 4
topic: text
functions: [TEXTSPLIT, TEXTBEFORE, TEXTAFTER, LEFT, MID, RIGHT, FIND, LEN]
exercises: [textbefore-and-textafter, left-find-prefix, mid-characters-from-the-middle, len-left-and-right-count-and-cut]
cover: "=TEXTSPLIT"
---

## Pick the tool by the data

- The parts are separated by a character, such as a comma or a hyphen: use TEXTSPLIT, TEXTBEFORE or TEXTAFTER.
- The parts have fixed lengths, such as a code where the first three characters are the region: use LEFT, MID and RIGHT.
- You only need to split once and the data will not change: use Text to Columns on the Data tab.

## TEXTSPLIT: every part at once

`=TEXTSPLIT(A2, ",")` splits "Smith,John,Leeds" into three cells across the row. The result spills to the right.

Give a second separator to split into rows as well, or several separators in curly brackets, such as `{",",";"}`.

## TEXTBEFORE and TEXTAFTER: one part

For "INV-2026-0451":

- `=TEXTBEFORE(A2, "-")` returns INV.
- `=TEXTAFTER(A2, "-")` returns 2026-0451.
- `=TEXTAFTER(A2, "-", -1)` returns 0451, the part after the last hyphen.

The third argument picks which hyphen to split on. A negative number counts from the end.

These three functions need Excel for Microsoft 365.

## LEFT, MID and RIGHT: fixed positions

- `=LEFT(A2, 3)` returns the first three characters.
- `=MID(A2, 5, 4)` returns four characters starting at the fifth.
- `=RIGHT(A2, 4)` returns the last four characters.

They work in every version of Excel.

## LEFT with FIND: split at a character in older Excel

FIND returns the position of a character. Combine it with LEFT and MID:

- Before the first hyphen: `=LEFT(A2, FIND("-", A2) - 1)`
- After the first hyphen: `=MID(A2, FIND("-", A2) + 1, LEN(A2))`

The `- 1` drops the hyphen itself. Giving MID the full length as the count returns everything that is left.

FIND returns `#VALUE!` if the character is missing. Wrap the formula in IFERROR, or use SEARCH, which ignores case.

## Text to Columns

Select the column, then go to Data, Text to Columns. Choose Delimited, pick the separator and finish. This changes the cells in place, so the result does not update when the source does.

## Things to watch

- The parts come back as text. A split date or number may need VALUE or DATEVALUE.
- Spaces after commas stay in the parts. Wrap the result in TRIM.
- Leading zeros, such as 0451, are kept as text. Converting them to numbers drops the zeros.
