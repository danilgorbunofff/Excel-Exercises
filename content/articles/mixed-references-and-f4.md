---

title: Mixed references and the F4 habit
description: Lock only the row or only the column, so one formula fills a whole grid correctly.
updated: 2026-11-16
minutes: 3
functions: [SUM, SUMIFS]
exercises: [multiply-price-by-quantity, running-total-down-a-column, sum-across-several-blocks]
cover: "=$A2*B$1"
---

## Four kinds of reference

When you copy a formula, each reference in it moves unless a dollar sign stops it:

- `A1` moves in both directions.
- `$A$1` never moves.
- `A$1` keeps the row fixed. The column can move.
- `$A1` keeps the column fixed. The row can move.

The last two are mixed references. The dollar sign sits in front of the part that must not change.

If the first two are new to you, read [how references change when you copy](/articles/relative-and-absolute-references/) first.

## The F4 habit

Click inside a reference in the formula bar and press F4. Each press moves to the next form: A1, $A$1, A$1, $A1, then back to A1.

On a Mac, Cmd+T does the same.

Press F4 while you write the formula, before you copy it. Fixing references afterwards in many cells is slow and easy to get wrong.

## The classic grid

A times table has numbers down column A and across row 1. In B2:

`=$A2*B$1`

Copy it across and down the whole grid. Every cell multiplies its row label by its column label:

- `$A2` always reads column A, but moves down the rows.
- `B$1` always reads row 1, but moves across the columns.

One formula, written once, fills every cell.

## A real use: a summary grid

Products run down column A and months across row 1. The data sits in a table called Sales. In B2:

`=SUMIFS(Sales[Amount], Sales[Product], $A2, Sales[Month], B$1)`

Copy it over the grid and each cell totals one product in one month.

## How to choose the dollar signs

Ask, for each reference: when I copy across, should the column change? When I copy down, should the row change? Put a dollar sign in front of each part whose answer is no.

## Common mistakes

- Locking everything with `$A$1` when the grid needs mixed references, so every cell shows the same value.
- Locking nothing, so the reference to a rate cell slides off it.
- Forgetting that a running total needs `$B$2:B2`, with the start fixed and the end free.
