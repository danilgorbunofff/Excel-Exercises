---

title: "IF, IFS and nested IF: when to stop nesting"
description: How to write a decision with two or more outcomes, and when a lookup table is the better tool.
updated: 2026-11-16
minutes: 4
functions: [IF, IFS, SWITCH, XLOOKUP]
exercises: [pass-or-fail, ifs-more-than-two-outcomes, switch-match-a-list-of-values, sales-bonus]
cover: "=IFS("
---

## One test, two outcomes

`=IF(B2>=50, "Pass", "Fail")` checks one condition and returns one of two values. The test can be any comparison that gives TRUE or FALSE.

## More outcomes with nested IF

To grade a score into A, B, C or Fail, you can put an IF inside the "no" part of another:

`=IF(B2>=80, "A", IF(B2>=65, "B", IF(B2>=50, "C", "Fail")))`

Excel checks the tests in order and stops at the first TRUE. That is why the order matters. If the test for 50 came first, an 85 would get a C.

## IFS reads more easily

IFS takes pairs of a test and a result, with no nesting:

`=IFS(B2>=80, "A", B2>=65, "B", B2>=50, "C", TRUE, "Fail")`

The last pair, `TRUE, "Fail"`, catches everything else. Without it, a score under 50 returns `#N/A`. IFS needs Excel 2019 or later.

## SWITCH for exact values

When you match one cell against a list of exact values, SWITCH is shorter:

`=SWITCH(C2, "N", "North", "S", "South", "E", "East", "Unknown")`

The final value is what to return when nothing matches.

## When to stop nesting

Move to a lookup table when:

- There are more than three or four bands.
- The thresholds or rates may change.
- Other people need to see the rules.

Put the thresholds in one column, sorted from low to high, and the grades in the next. Then use:

`=XLOOKUP(B2, E2:E5, F2:F5, , -1)`

The `-1` finds the threshold at or just below the score. Changing a rate now means editing a cell, not a formula.

## Common mistakes

- Tests in the wrong order, so a wide band catches values meant for a narrow one.
- Numbers in quotes, such as `">=50"`, inside IF. That compares with text. Quotes are needed in COUNTIF, not in IF.
- Gaps between bands, such as one test for over 50 and the next for under 50, so exactly 50 falls through.
