---

title: Relative and absolute references
description: Why a copied formula changes its cell addresses, and how a dollar sign keeps one fixed.
updated: 2026-11-11
minutes: 4
topic: habits
functions: []
exercises: [add-two-cells, multiply-price-by-quantity, price-after-discount]
cover: "$A$1"
---

## What a reference is

A formula points at cells by their address. In `=B2+B3`, Excel reads the value in B2 and the value in B3 and adds them. When either value changes, the result changes with it.

That is the whole reason to point at cells instead of typing numbers. A formula with typed numbers gives the right answer once and the wrong answer after the next edit.

## Relative references move when you copy

Most references are relative. Excel stores them as a direction from the formula's own cell, not as a fixed place.

Say C2 holds `=A2*B2`. Copy it down to C3 and Excel writes `=A3*B3`. Each row multiplies its own price by its own quantity, which is usually what you want.

## Absolute references stay put

Sometimes every row must read the same cell, such as one tax rate in F1. Copy `=B2*F1` down a row and it becomes `=B3*F2`, which reads an empty cell.

A dollar sign fixes the part after it. `=B2*$F$1` keeps pointing at F1 wherever you copy it. The B2 part still moves with each row.

## Mixed references

You can fix only the column or only the row:

- `$F1` keeps column F and lets the row move.
- `F$1` keeps row 1 and lets the column move.

Mixed references are useful in a table that multiplies a row of values by a column of values.

## A quick way to type them

In Excel, select a reference in the formula bar and press F4. Each press cycles through `F1`, `$F$1`, `F$1` and `$F1`.
