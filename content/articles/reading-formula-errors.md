---

title: How to read a formula error
description: What the common error values in a cell mean, and the first thing to check for each.
updated: 2026-11-11
minutes: 4
topic: logic
functions: [IF, VLOOKUP, XLOOKUP]
exercises: [sum-a-column, find-a-price, pass-or-fail]
cover: "#N/A"
---

Each error value names one kind of problem. Read the code first, then check the one thing it points to before you change the formula.

## The common ones

`#DIV/0!` The formula divided by zero or by an empty cell. Check the cell after the slash.

`#N/A` A lookup found no match. Check spelling, extra spaces and whether a number is stored as text.

`#NAME?` Excel does not know a name in the formula. A function name is often misspelt, or text is missing its quotes.

`#VALUE!` A value has the wrong type, such as text where a number belongs. Check each cell the formula reads.

`#REF!` The formula points at a cell that no longer exists, often after a row or column was deleted.

`#SPILL!` A formula that returns several values has no room to spill. Clear the cells in its way.

## A habit that helps

Select the cell and press F2. Excel colours each reference and outlines the cells it reads, as this site does after each check.

If the outline is not where you expected, the reference is wrong. Fix that before anything else.
