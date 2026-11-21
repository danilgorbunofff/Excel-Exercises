---

title: How to audit a formula you inherited
description: Step through a long formula you did not write, find what it reads, and spot the parts most likely to be wrong.
updated: 2026-11-16
minutes: 4
topic: habits
functions: [FORMULATEXT, ISFORMULA, IFERROR]
exercises: [formula-audit-fix-five-broken-sheets, debug-a-total-that-skips-a-row, error-handling-summary]
cover: "F2 + F9"
---

## Start by reading it whole

Click the cell and widen the formula bar with the arrow on its right. Say in words what the formula seems to do before you test any part of it.

## See what it reads: F2

Press F2 in the cell. Each reference gets a coloured border on the sheet. Look for ranges that stop short, start on the wrong row or point at a different sheet.

## Follow it back: Trace Precedents

On the Formulas tab, Trace Precedents draws arrows from the cells the formula reads. Click it again to go one more step back. Trace Dependents does the opposite and shows what would break if you changed this cell.

Ctrl+[ jumps straight to the cells the formula reads.

## Step through it: Evaluate Formula

Formulas > Evaluate Formula shows the formula with one part underlined. Each click on Evaluate works that part out, until the whole result appears. This shows exactly where a value goes wrong.

## Test one part: F9

In the formula bar, select part of the formula, such as one MATCH, and press F9. Excel shows the value of that part.

Press Esc afterwards. If you press Enter, the value replaces that part of the formula for good.

## Find typed numbers

Typed numbers inside formulas, such as `*1.2`, are a common source of errors because nobody updates them. Go to Home > Find & Select > Go To Special, then pick Constants to see typed values, or Formulas to see formulas. A typed number in a column of formulas stands out.

## Check consistency down a column

Every row in a calculated column should hold the same formula. Excel marks a cell whose formula differs from its neighbours with a green triangle. Press `` Ctrl+` `` to show formulas instead of results, and scan the column.

## Look for hidden error handling

IFERROR around a whole formula can hide a broken range or a missing lookup value. Remove it for a moment and see what errors appear.

## Write down what you find

Add a note to each cell you change, or keep a list on a separate sheet. The next person to open the file, often you, then knows what changed and why.
