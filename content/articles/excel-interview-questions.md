---

title: 25 Excel interview questions, with answers
description: The questions that come up most in interviews for analyst, finance and operations roles, with short answers.
updated: 2026-11-16
minutes: 8
functions: [XLOOKUP, VLOOKUP, INDEX, MATCH, SUMIFS, COUNTIFS, IF, IFERROR, IFNA]
exercises: [lookup-functions-summary, sumifs-two-conditions-at-once, formula-audit-fix-five-broken-sheets, index-match]
cover: "Q1 to Q25"
---

## How to use this list

Read each question and answer it out loud before you read the answer. Then try the matching task on a real sheet. Interviewers care less about the words and more about whether you can build the formula. The interview tracks on the [learning tracks page](/exercises/tracks/#g-interview) give you that practice.

## Lookups

**1. What is the difference between VLOOKUP and XLOOKUP?** VLOOKUP searches the first column and returns a column by number. XLOOKUP takes the search and return columns separately, defaults to an exact match and can look left.

**2. Why does VLOOKUP need FALSE at the end?** Without it, VLOOKUP does an approximate match on data it assumes is sorted, and can return a wrong row without an error.

**3. How do you look up a value to the left?** Use XLOOKUP, or INDEX with MATCH: `=INDEX(A:A, MATCH(H2, D:D, 0))`.

**4. How do you look up by row and column at once?** INDEX with two MATCH functions, one for the row and one for the column.

**5. What does `#N/A` mean in a lookup, and how do you handle it?** No match was found. Check for spaces and text numbers first. Then show a message with IFNA, which only catches `#N/A`.

## Sums and counts

**6. How do you add up sales for one region and one month?** SUMIFS, with the sum range first and a range and condition for each test.

**7. What is the difference between COUNT, COUNTA and COUNTBLANK?** COUNT counts numbers, COUNTA counts non-empty cells and COUNTBLANK counts empty ones.

**8. How do you count rows that meet two conditions?** COUNTIFS. For OR conditions, add two COUNTIFS together.

**9. What does SUMPRODUCT do?** It multiplies ranges row by row and adds the results. It is used for weighted totals and for conditions SUMIFS cannot express.

**10. How do you count unique values?** `=COUNTA(UNIQUE(range))` in current Excel, or a PivotTable with a distinct count.

## Logic and errors

**11. How do you return one of three results?** IFS, a nested IF, or a lookup on a small band table when the bands may change.

**12. What is the difference between IFERROR and IFNA?** IFERROR hides every error, including real mistakes. IFNA only catches `#N/A`, so other problems stay visible.

**13. What do `#REF!`, `#VALUE!` and `#DIV/0!` mean?** A reference to a deleted cell, the wrong type of value such as text in maths, and division by zero or a blank.

## References and structure

**14. What is the difference between A1, $A$1 and A$1?** A1 moves fully when copied, $A$1 never moves, and A$1 keeps the row fixed but lets the column move.

**15. Why use an Excel table?** It grows with new rows, names its columns in formulas and copies a formula down a whole column at once.

**16. What is a PivotTable for?** Summarising a list by categories, such as sales by region and month, without writing formulas.

## Text and dates

**17. How do you split "Smith, John" into two cells?** TEXTBEFORE and TEXTAFTER, or LEFT and MID with FIND in older versions.

**18. Why does a number not add up in SUM?** It is stored as text. Convert it with VALUE, Text to Columns or the warning button.

**19. How does Excel store a date?** As a whole number of days since 1900. Times are fractions of a day.

**20. How do you find the last day of a month?** `=EOMONTH(A2, 0)`.

## Working practice

**21. How do you check a formula someone else built?** Use F2 to see the ranges it reads, Evaluate Formula to step through it, and Trace Precedents to follow it back.

**22. How do you make a model easy to change?** Put inputs such as rates and dates in labelled cells, not inside formulas.

**23. How do you check a report is right?** Add control totals that compare with the source, and a cell that shows whether all checks pass.

**24. What shortcuts do you use most?** Ctrl+Arrow to move, Ctrl+Shift+Arrow to select, F4 to lock references and Alt+= for AutoSum are good answers.

**25. Tell me about a spreadsheet you improved.** Name the problem, what you changed, and the time or errors it saved. Bring numbers if you can.
