---

title: "Numbers stored as text: how to spot and fix them"
description: Why some numbers are left out of totals and lookups, and five ways to turn them back into numbers.
updated: 2026-11-16
minutes: 4
topic: text
functions: [VALUE, NUMBERVALUE, ISNUMBER, ISTEXT, SUM]
exercises: [clean-up-an-imported-list, isblank-isnumber-istext, clean-a-product-code-then-look-it-up]
cover: "'1001"
---

## Why it matters

A number stored as text looks like a number but behaves like a word. SUM skips it without warning, so totals come out low. Lookups treat 1001 and "1001" as different values, so they return `#N/A`.

## How to spot them

- The value sits on the left of the cell, while real numbers sit on the right.
- A small green triangle shows in the top-left corner of the cell.
- The status bar shows a Count but no Sum when you select the cells.
- `=ISTEXT(A2)` returns TRUE, and `=ISNUMBER(A2)` returns FALSE.

To count them in a column: `=SUMPRODUCT(--ISTEXT(A2:A500))`.

## Where they come from

- Data exported from another system or copied from a web page.
- A cell formatted as Text before the number was typed.
- A number typed with an apostrophe in front, such as '1001.
- Formulas that build a value with LEFT, MID or `&`. These always return text.

## Five ways to fix them

1. Select the cells, click the warning icon next to them, and choose Convert to Number.
2. Select one column, choose Data > Text to Columns, and click Finish. Excel reads every cell again, and numbers come back as numbers.
3. Type 1 in a spare cell and copy it. Select the text numbers, then choose Home > Paste > Paste Special and pick Multiply.
4. In a formula, `=VALUE(A2)` turns text into a number. Wrap LEFT or MID in VALUE to turn the result of a split into a number.
5. `=--A2` does the same as VALUE in fewer characters. The first minus turns the text into a negative number, and the second turns it back.

## Numbers with other separators

"1.234,56" uses a comma for decimals. With en-US settings, VALUE does not read it as 1234.56. Tell Excel which separators the text uses:

`=NUMBERVALUE(A2, ",", ".")`

The second argument is the decimal separator and the third is the group separator.

## When text is right

Keep codes as text when the leading zeros matter, such as postcodes, phone numbers or product codes like 004512. Converting them to numbers drops the zeros. Make the lookup table match instead, with `A2&""` to turn a number into text.

## Checks

- After fixing, `=COUNT(A2:A500)` should equal the number of filled cells.
- Compare `=SUM(A2:A500)` before and after. A higher total after the fix shows how much was missing.
