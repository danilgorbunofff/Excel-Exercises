---

title: AND, OR and NOT inside IF
description: How to test two or more conditions at once, with worked examples you can copy.
updated: 2026-11-16
minutes: 3
functions: [AND, OR, NOT, IF]
exercises: [and-or-not-combining-tests, both-scores-pass, free-delivery]
cover: "AND/OR/NOT"
---

## What each one returns

- `AND(test1, test2)` is TRUE only when every test is TRUE.
- `OR(test1, test2)` is TRUE when at least one test is TRUE.
- `NOT(test)` turns TRUE into FALSE and FALSE into TRUE.

On their own they return TRUE or FALSE. Inside IF, they decide which result to show.

## Both conditions: AND

A student passes only if both scores in B2 and C2 are 50 or more:

`=IF(AND(B2>=50, C2>=50), "Pass", "Fail")`

## Either condition: OR

An order ships free if it is over 100 or the customer is a member:

`=IF(OR(B2>100, C2="Member"), "Free", "Charge")`

## Not this one: NOT

Flag every order that is not cancelled:

`=IF(NOT(C2="Cancelled"), "Open", "")`

`C2<>"Cancelled"` does the same and is shorter. NOT is most useful in front of a function, such as `NOT(ISBLANK(A2))`.

## Mixing them

A bonus is paid if sales beat target and the person is not on probation, or if they are a team lead:

`=IF(OR(AND(B2>C2, D2<>"Probation"), E2="Lead"), "Bonus", "")`

Read it from the inside out. Write mixed tests in a helper column first if the logic is hard to check.

## Between two numbers

To test whether B2 is from 10 to 20, use AND with both ends:

`=IF(AND(B2>=10, B2<=20), "In range", "Out")`

Writing `10<=B2<=20` does not work in Excel. It compares 10 with B2 first, then compares that TRUE or FALSE with 20.

## Common mistakes

- Using AND where you meant OR. Say the rule in words first: "both" means AND, "either" means OR.
- Testing for blank with `B2=0`. An empty cell equals 0 in a comparison, so use `B2=""` when you mean empty.
- Forgetting that text comparisons ignore case, so "member" and "Member" match.
