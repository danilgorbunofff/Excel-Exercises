// Ladder steps for the "logic" track (docs/content.md, Ladder steps). The
// YAML files are the source of truth once written: variants added later by
// tools/suggest-variants.ts and by hand live only there, so do not --write this again.
// Each exercise's own slot: level 1 at step 1, level 2 at step 3, level 3 at step 4.
const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
const step = (parent, n, level, title, screen) => ({
  parent,
  step: n,
  level,
  title,
  screens: [screen],
});

export default [
  // pass-or-fail (level 1, step 1)
  step("pass-or-fail", 2, 1, "Flag stock to reorder", {
    prompt: "In C2, show Reorder when the stock in B2 is below 20, and OK when it is not. Use IF.",
    rows: [
      ["Item", "Stock", "Action"],
      ["Pens", 12, null],
    ],
    cell: "C2",
    answer: '=IF(B2<20,"Reorder","OK")',
    required: ["IF"],
    accept: ['=IF(B2>=20,"OK","Reorder")'],
    variants: [{ B2: 25 }],
    reject: [['=IF(B2>20,"Reorder","OK")', "value"]],
    nudge: "The test is whether B2 is below 20.",
    rule: 'IF(test, value if true, value if false): IF(B2<20,"Reorder","OK").',
    value: (e) => `With 12 in stock, C2 should show ${e}. Check the direction of the test.`,
  }),
  step("pass-or-fail", 3, 2, "Pass mark kept in its own cell", {
    prompt:
      "The pass mark is in F1. In C3, show Pass if Ben's score in B3 is at least the pass mark, and Fail if not. Use IF.",
    rows: [
      ["Student", "Score", "Result", null, "Pass mark", 55],
      ["Ana", 61, null, null, null, null],
      ["Ben", 55, null, null, null, null],
      ["Cy", 48, null, null, null, null],
    ],
    cell: "C3",
    answer: '=IF(B3>=$F$1,"Pass","Fail")',
    required: ["IF"],
    accept: ['=IF(B3>=F1,"Pass","Fail")', '=IF(B3<$F$1,"Fail","Pass")'],
    variants: [{ F1: 60 }],
    reject: [
      ['=IF(B3>$F$1,"Pass","Fail")', "value"],
      ['=IF(B3>=55,"Pass","Fail")', "fragile"],
    ],
    nudge: "Compare B3 with F1, and remember that exactly the pass mark is a pass.",
    rule: '>= means at least, so IF(B3>=$F$1,"Pass","Fail") passes a score equal to the mark.',
    value: (e) => `Ben scored exactly the pass mark, so C3 should show ${e}. Use >= rather than >.`,
  }),
  step("pass-or-fail", 4, 2, "Charge a late fee only when late", {
    prompt:
      "In D2, charge a late fee of 2% of the amount when the invoice is paid late, that is when the days late in C2 are over 0. Otherwise the fee is 0. Use IF.",
    rows: [
      ["Invoice", "Amount", "Days late", "Fee"],
      ["INV-7", 1200, 5, null],
    ],
    cell: "D2",
    answer: "=IF(C2>0,B2*2%,0)",
    required: ["IF"],
    accept: ["=IF(C2>0,B2*0.02,0)", "=IF(C2<=0,0,B2*2%)"],
    variants: [{ C2: 0 }, { B2: 900 }],
    reject: [
      ["=IF(C2>0,2%,0)", "value"],
      ["=IF(C2>0,24,0)", "fragile"],
    ],
    nudge: "When late, the fee is a sum: the amount times 2%.",
    rule: "IF can return a calculation: IF(C2>0,B2*2%,0) gives 2% of the amount when late and 0 when not.",
    value: (e) => `The fee is ${e}: 2% of the amount, because the invoice is late.`,
  }),
  step("pass-or-fail", 5, 3, "Pass overall on three tests", {
    prompt:
      "In E2, does Ana pass overall? A pass needs an average of 50 or more across the three tests and no single test below 40. Show Pass or Fail.",
    rows: [
      ["Student", "Test 1", "Test 2", "Test 3", "Result"],
      ["Ana", 72, 48, 65, null],
    ],
    cell: "E2",
    answer: '=IF(AND(AVERAGE(B2:D2)>=50,MIN(B2:D2)>=40),"Pass","Fail")',
    required: [],
    accept: ['=IF(OR(AVERAGE(B2:D2)<50,MIN(B2:D2)<40),"Fail","Pass")'],
    variants: [{ C2: 38 }, { B2: 45, C2: 42, D2: 50 }],
    reject: [
      ['=IF(AVERAGE(B2:D2)>=50,"Pass","Fail")', "fragile"],
      ['=IF(MIN(B2:D2)>=40,"Pass","Fail")', "fragile"],
    ],
    nudge: "Two tests must both hold: the average and the lowest score.",
    rule: 'AND(AVERAGE(B2:D2)>=50,MIN(B2:D2)>=40) is TRUE only when both rules hold; IF turns it into "Pass" or "Fail".',
    value: (e) => `Ana's result is ${e}. Check both the average and the lowest test.`,
  }),

  // sales-bonus (level 2, step 3)
  step("sales-bonus", 1, 1, "A flat bonus over a target", {
    prompt:
      "In C2, give a bonus of 100 when the sales in B2 are over 5,000, and 0 otherwise. Use IF.",
    rows: [
      ["Rep", "Sales", "Bonus"],
      ["Ana", 6200, null],
    ],
    cell: "C2",
    answer: "=IF(B2>5000,100,0)",
    required: ["IF"],
    accept: ["=IF(B2<=5000,0,100)"],
    variants: [{ B2: 4000 }],
    reject: [["=IF(B2<5000,100,0)", "value"]],
    nudge: "Test whether B2 is over 5000.",
    rule: "IF(B2>5000,100,0) gives 100 above the target and 0 at or below it.",
    value: (e) => `Ana's bonus is ${e}. Her sales are over 5,000.`,
  }),
  step("sales-bonus", 2, 2, "Commission rate that depends on sales", {
    prompt:
      "Reps with sales of 8,000 or more earn 6% commission; the rest earn 4%. In C2, work out Mo's commission. Use IF.",
    rows: [
      ["Rep", "Sales", "Commission"],
      ["Mo", 9500, null],
    ],
    cell: "C2",
    answer: "=B2*IF(B2>=8000,6%,4%)",
    required: ["IF"],
    accept: ["=IF(B2>=8000,B2*6%,B2*4%)", "=IF(B2>=8000,B2*0.06,B2*0.04)"],
    variants: [{ B2: 7000 }, { B2: 8000 }],
    reject: [
      ["=IF(B2>=8000,6%,4%)", "value"],
      ["=IF(B2>8000,B2*6%,B2*4%)", "fragile"],
    ],
    nudge: "IF picks the rate; then multiply the sales by it.",
    rule: "IF(B2>=8000,6%,4%) chooses the rate, and B2 times that rate is the commission.",
    value: (e) => `Mo's commission is ${e}: 6% of 9,500.`,
  }),
  step("sales-bonus", 4, 2, "Bonus with the target and rate in cells", {
    prompt:
      "The target is in F1 and the bonus rate in F2. In C4, work out Cy's bonus: the rate times the sales when the sales in B4 are over the target, and 0 otherwise. Use IF.",
    rows: [
      ["Rep", "Sales", "Bonus", null, "Target", 10000],
      ["Ana", 12500, null, null, "Rate", 0.05],
      ["Ben", 9800, null, null, null, null],
      ["Cy", 15200, null, null, null, null],
    ],
    cell: "C4",
    answer: "=IF(B4>$F$1,B4*$F$2,0)",
    required: ["IF"],
    accept: ["=IF(B4>F1,B4*F2,0)", "=IF(B4<=$F$1,0,B4*$F$2)"],
    variants: [{ F2: 0.06 }, { F1: 16000 }],
    reject: [
      ["=IF(B4>10000,B4*0.05,0)", "reference"],
      ["=B4*$F$2", "required-function"],
    ],
    nudge: "Point at F1 for the target and F2 for the rate, not at the numbers you see.",
    rule: "IF(B4>$F$1,B4*$F$2,0) follows any change to the target or the rate.",
    value: (e) => `Cy's bonus is ${e}: the rate in F2 times the sales, as they beat the target.`,
  }),
  step("sales-bonus", 5, 3, "Bonus only on sales above target", {
    prompt:
      "In C2, what is Mo's bonus? Reps earn 3% on the part of their sales above the 10,000 target, and nothing when they miss it.",
    rows: [
      ["Rep", "Sales", "Bonus"],
      ["Mo", 13400, null],
    ],
    cell: "C2",
    answer: "=MAX(0,B2-10000)*3%",
    required: [],
    accept: ["=IF(B2>10000,(B2-10000)*3%,0)", "=MAX(0,(B2-10000)*0.03)"],
    variants: [{ B2: 9000 }, { B2: 20000 }],
    reject: [
      ["=IF(B2>10000,B2*3%,0)", "value"],
      ["=(B2-10000)*3%", "fragile"],
    ],
    nudge: "Only the sales above 10,000 earn the bonus, and a miss earns 0, not a negative number.",
    rule: "B2-10000 is the part above target; MAX(0, ...) stops a miss from going negative. Then take 3%.",
    value: (e) => `Mo's bonus is ${fmt(e)}: 3% of the 3,400 above target, not of all his sales.`,
  }),

  // both-scores-pass (level 2, step 3)
  step("both-scores-pass", 1, 1, "Both checks done", {
    prompt:
      "In D2, show TRUE when the box is both checked and packed, that is when B2 and C2 both say Yes. Use AND.",
    rows: [
      ["Item", "Checked", "Packed", "Ready"],
      ["Box 1", "Yes", "Yes", null],
    ],
    cell: "D2",
    answer: '=AND(B2="Yes",C2="Yes")',
    required: ["AND"],
    accept: ['=AND(C2="Yes",B2="Yes")'],
    variants: [{ C2: "No" }],
    reject: [
      ['=OR(B2="Yes",C2="Yes")', "required-function"],
      ['=B2="Yes"', "required-function"],
    ],
    nudge: "AND is TRUE only when every test is TRUE.",
    rule: 'AND(B2="Yes",C2="Yes") checks both cells. Text in a test goes in quotes.',
    value: (e) => `Both cells say Yes, so D2 should show ${e}.`,
  }),
  step("both-scores-pass", 2, 2, "Three scores must all pass", {
    prompt:
      "A candidate passes when all three scores are at least 60. In E2, show TRUE if Lee passed and FALSE if not. Use AND.",
    rows: [
      ["Candidate", "Written", "Practical", "Interview", "Passed"],
      ["Lee", 72, 64, 61, null],
    ],
    cell: "E2",
    answer: "=AND(B2>=60,C2>=60,D2>=60)",
    required: ["AND"],
    accept: ["=AND(MIN(B2:D2)>=60)"],
    variants: [{ D2: 55 }, { B2: 59 }, { C2: 50 }],
    reject: [
      ["=AND(B2>=60,C2>=60)", "fragile"],
      ["=AND(B2>=60,D2>=60)", "fragile"],
    ],
    nudge: "AND takes as many tests as you need, separated by commas.",
    rule: "AND(B2>=60,C2>=60,D2>=60) is TRUE only when all three scores reach 60.",
    value: (e) => `Lee's result is ${e}. Test all three scores.`,
  }),
  step("both-scores-pass", 4, 2, "Hire only when both pass", {
    prompt:
      "In D2, show Hire when both of Lee's scores are at least 60, and Reject otherwise. Use IF and AND.",
    rows: [
      ["Candidate", "Written", "Practical", "Decision"],
      ["Lee", 72, 58, null],
    ],
    cell: "D2",
    answer: '=IF(AND(B2>=60,C2>=60),"Hire","Reject")',
    required: ["IF", "AND"],
    accept: ['=IF(AND(C2>=60,B2>=60),"Hire","Reject")'],
    variants: [{ C2: 60 }],
    reject: [
      ['=IF(OR(B2>=60,C2>=60),"Hire","Reject")', "required-function"],
      ['=IF(AND(B2>=60,C2>60),"Hire","Reject")', "fragile"],
    ],
    nudge: "Put the AND test inside IF as its first part.",
    rule: 'IF(AND(B2>=60,C2>=60),"Hire","Reject") hires only when both tests pass.',
    value: (e) => `Lee's practical is under 60, so D2 should show ${e}.`,
  }),
  step("both-scores-pass", 5, 3, "Parcel within the size limits", {
    prompt:
      "In F2, can the parcel go by standard post? It must weigh 30 kg or less and no side may be longer than 100 cm. Show TRUE or FALSE.",
    rows: [
      ["Parcel", "Weight", "Length", "Width", "Height", "Standard post"],
      ["P-1", 24, 95, 60, 90, null],
    ],
    cell: "F2",
    answer: "=AND(B2<=30,MAX(C2:E2)<=100)",
    required: [],
    accept: ["=AND(B2<=30,C2<=100,D2<=100,E2<=100)"],
    variants: [{ E2: 102 }, { B2: 31 }, { D2: 101 }],
    reject: [
      ["=AND(B2<=30,C2<=100)", "fragile"],
      ["=B2<=30", "fragile"],
    ],
    nudge: "The longest side is the one that matters for the size rule.",
    rule: "MAX(C2:E2)<=100 checks every side at once; AND joins it with the weight test.",
    value: (e) => `The parcel's answer is ${e}. Check the weight and every side.`,
  }),

  // free-delivery (level 2, step 3)
  step("free-delivery", 1, 1, "Works at the weekend", {
    prompt:
      "In D2, show TRUE when Ana works on Saturday or on Sunday, that is when either B2 or C2 says Yes. Use OR.",
    rows: [
      ["Name", "Saturday", "Sunday", "Weekend"],
      ["Ana", "No", "Yes", null],
    ],
    cell: "D2",
    answer: '=OR(B2="Yes",C2="Yes")',
    required: ["OR"],
    accept: ['=OR(C2="Yes",B2="Yes")'],
    variants: [{ C2: "No" }],
    reject: [['=AND(B2="Yes",C2="Yes")', "required-function"]],
    nudge: "OR is TRUE when at least one test is TRUE.",
    rule: 'OR(B2="Yes",C2="Yes") is TRUE if either day says Yes.',
    value: (e) => `Ana works on Sunday, so D2 should show ${e}.`,
  }),
  step("free-delivery", 2, 2, "Flag an account for review", {
    prompt:
      "Flag the account when the balance in B2 is below 0 or the invoice is more than 30 days overdue. In D2, show TRUE or FALSE. Use OR.",
    rows: [
      ["Account", "Balance", "Days overdue", "Flag"],
      ["A-12", 150, 45, null],
    ],
    cell: "D2",
    answer: "=OR(B2<0,C2>30)",
    required: ["OR"],
    accept: ["=OR(C2>30,B2<0)"],
    variants: [{ C2: 10 }, { C2: 30 }],
    reject: [
      ["=AND(B2<0,C2>30)", "required-function"],
      ["=OR(B2<0,C2>=30)", "fragile"],
    ],
    nudge: "Either reason is enough to flag the account.",
    rule: "OR(B2<0,C2>30) is TRUE when the balance is negative, the invoice is over 30 days late, or both.",
    value: (e) => `The account is 45 days overdue, so D2 should show ${e}.`,
  }),
  step("free-delivery", 4, 2, "Delivery charge with free delivery", {
    prompt:
      "Delivery costs 4.99 but is free when the order in B2 is over 50 or the customer is a member. In D2, work out Ola's delivery charge. Use IF and OR.",
    rows: [
      ["Customer", "Order", "Member", "Delivery"],
      ["Ola", 38, "No", null],
    ],
    cell: "D2",
    answer: '=IF(OR(B2>50,C2="Yes"),0,4.99)',
    required: ["IF", "OR"],
    accept: ['=IF(OR(C2="Yes",B2>50),0,4.99)'],
    variants: [{ C2: "Yes" }, { B2: 60 }],
    reject: [
      ["=IF(B2>50,0,4.99)", "required-function"],
      ['=IF(AND(B2>50,C2="Yes"),0,4.99)', "required-function"],
    ],
    nudge: "OR goes inside IF as its test; free means 0.",
    rule: 'IF(OR(B2>50,C2="Yes"),0,4.99) charges nothing when either reason applies.',
    value: (e) => `Ola pays ${e}: her order is under 50 and she is not a member.`,
  }),
  step("free-delivery", 5, 3, "Free returns, except on sale items", {
    prompt:
      "In E2, does this order get free returns? They apply when the order is over 100 or the customer is a member, but never to sale items. Show TRUE or FALSE.",
    rows: [
      ["Order", "Value", "Member", "Type", "Free returns"],
      ["O-5", 140, "No", "Sale", null],
    ],
    cell: "E2",
    answer: '=AND(OR(B2>100,C2="Yes"),D2<>"Sale")',
    required: [],
    accept: ['=IF(D2="Sale",FALSE,OR(B2>100,C2="Yes"))'],
    variants: [{ D2: "Full price" }, { B2: 80, C2: "Yes", D2: "Full price" }],
    reject: [
      ['=OR(B2>100,C2="Yes")', "value"],
      ['=AND(B2>100,D2<>"Sale")', "fragile"],
    ],
    nudge: "First the OR test for qualifying, then AND it with not being a sale item.",
    rule: 'OR(B2>100,C2="Yes") decides who qualifies; AND with D2<>"Sale" removes sale items.',
    value: (e) => `This order's answer is ${e}: it is a sale item.`,
  }),

  // true-and-false-what-a-comparison-returns (level 2, step 3)
  step("true-and-false-what-a-comparison-returns", 1, 1, "Did the rep hit the target", {
    prompt:
      "In C2, answer TRUE when the sales in B2 are at least the target of 500, with a comparison only.",
    rows: [
      ["Rep", "Sales", "Hit target"],
      ["Ana", 500, null],
    ],
    cell: "C2",
    answer: "=B2>=500",
    required: [],
    accept: ["=500<=B2", "=NOT(B2<500)"],
    variants: [{ B2: 480 }],
    reject: [["=B2>500", "value"]],
    nudge: "A comparison such as B2>=500 gives TRUE or FALSE on its own.",
    rule: ">= means at least, so exactly 500 counts.",
    value: (e) => `Ana sold exactly 500, so C2 should show ${e}.`,
  }),
  step("true-and-false-what-a-comparison-returns", 2, 1, "Is the invoice paid", {
    prompt: "In C2, answer TRUE when the status in B2 is Paid, with a comparison only.",
    rows: [
      ["Invoice", "Status", "Paid?"],
      ["INV-3", "Paid", null],
    ],
    cell: "C2",
    answer: '=B2="Paid"',
    required: [],
    accept: ['="Paid"=B2', '=EXACT(B2,"Paid")'],
    variants: [{ B2: "Due" }],
    reject: [['=B2="Due"', "value"]],
    nudge: "Compare the cell with the word, written in quotes.",
    rule: 'B2="Paid" is TRUE when the cell holds exactly the word Paid.',
    value: (e) => `The status is Paid, so C2 should show ${e}.`,
  }),
  step("true-and-false-what-a-comparison-returns", 4, 2, "Spending within budget", {
    prompt:
      "In B8, answer TRUE when the total spent in B2 to B6 is within the budget in E1, that is no more than it. Use SUM.",
    rows: [
      ["Cost", "Amount", null, "Budget", 1200],
      ["Rent", 650, null, null, null],
      ["Power", 140, null, null, null],
      ["Phone", 60, null, null, null],
      ["Supplies", 230, null, null, null],
      ["Travel", 120, null, null, null],
      [null, null, null, null, null],
      ["Within budget?", null, null, null, null],
    ],
    cell: "B8",
    answer: "=SUM(B2:B6)<=E1",
    required: ["SUM"],
    accept: ["=E1>=SUM(B2:B6)", "=SUM(B2:B6)<=$E$1"],
    variants: [{ B3: 160 }, { E1: 1000 }],
    reject: [
      ["=SUM(B2:B6)<E1", "value"],
      ["=SUM(B2:B6)<=1200", "fragile"],
    ],
    nudge: "Total the costs, then compare the total with E1.",
    rule: "SUM(B2:B6)<=E1 is TRUE when the spending is no more than the budget, including exactly equal.",
    value: (e) => `The costs add up to exactly the budget, so B8 should show ${e}.`,
  }),
  step("true-and-false-what-a-comparison-returns", 5, 3, "Did sales grow every month", {
    prompt:
      "In D2, did sales grow every month from January to June, each month above the one before? Show TRUE or FALSE.",
    rows: [
      ["Month", "Sales", null, "Grew every month", null],
      ["Jan", 410, null, null, null],
      ["Feb", 425, null, null, null],
      ["Mar", 440, null, null, null],
      ["Apr", 462, null, null, null],
      ["May", 470, null, null, null],
      ["Jun", 495, null, null, null],
    ].map((r, i) => (i === 1 ? [r[0], r[1], null, null, null] : r)),
    cell: "D2",
    answer: "=AND(B3:B7>B2:B6)",
    required: [],
    accept: ["=SUMPRODUCT(--(B3:B7<=B2:B6))=0", "=AND(B3>B2,B4>B3,B5>B4,B6>B5,B7>B6)"],
    variants: [{ B5: 420 }, { B3: 400 }],
    reject: [
      ["=B7>B2", "fragile"],
      ["=AND(B3>B2,B7>B6)", "fragile"],
    ],
    nudge: "Compare each month with the month above it, all at once.",
    rule: "B3:B7>B2:B6 compares each month with the one before; AND is TRUE only if every comparison is.",
    value: (e) => `The answer is ${e}. Every month must beat the month before it.`,
  }),

  // and-or-not-combining-tests (level 3, step 4)
  step("and-or-not-combining-tests", 1, 1, "Not discontinued", {
    prompt:
      "In C2, answer TRUE when the lamp is not discontinued, that is when B2 does not say Yes. Use NOT.",
    rows: [
      ["Item", "Discontinued", "Can sell"],
      ["Lamp", "No", null],
    ],
    cell: "C2",
    answer: '=NOT(B2="Yes")',
    required: ["NOT"],
    accept: ['=NOT(B2="yes")'],
    variants: [{ B2: "Yes" }],
    reject: [
      ['=B2="Yes"', "required-function"],
      ['=B2<>"Yes"', "required-function"],
    ],
    nudge: "NOT turns TRUE into FALSE and FALSE into TRUE.",
    rule: 'NOT(B2="Yes") is TRUE when B2 is anything but Yes.',
    value: (e) => `The lamp is not discontinued, so C2 should show ${e}.`,
  }),
  step("and-or-not-combining-tests", 2, 2, "In stock and not discontinued", {
    prompt:
      "In D2, answer TRUE when the lamp is in stock, B2 over 0, and not discontinued, C2 not Yes. Use AND and NOT.",
    rows: [
      ["Item", "Stock", "Discontinued", "Sell"],
      ["Lamp", 14, "No", null],
    ],
    cell: "D2",
    answer: '=AND(B2>0,NOT(C2="Yes"))',
    required: ["AND", "NOT"],
    accept: ['=AND(NOT(C2="Yes"),B2>0)'],
    variants: [{ C2: "Yes" }, { B2: 0 }],
    reject: [
      ['=AND(B2>0,C2="Yes")', "required-function"],
      ["=B2>0", "required-function"],
    ],
    nudge: "NOT goes inside AND as one of its tests.",
    rule: 'AND(B2>0,NOT(C2="Yes")) needs stock and a product that is still sold.',
    value: (e) => `The lamp is in stock and still sold, so D2 should show ${e}.`,
  }),
  step("and-or-not-combining-tests", 3, 2, "Member, or a large card order", {
    prompt:
      "A discount applies to members, or to orders over 100 paid by card. In E2, answer TRUE or FALSE for this order. Use OR and AND.",
    rows: [
      ["Order", "Member", "Value", "Paid by", "Discount"],
      ["O-9", "No", 120, "Card", null],
    ],
    cell: "E2",
    answer: '=OR(B2="Yes",AND(C2>100,D2="Card"))',
    required: ["OR", "AND"],
    accept: ['=OR(AND(C2>100,D2="Card"),B2="Yes")'],
    variants: [{ D2: "Cash" }, { C2: 90 }],
    reject: [
      ['=OR(B2="Yes",C2>100)', "required-function"],
      ['=AND(B2="Yes",C2>100,D2="Card")', "required-function"],
    ],
    nudge:
      "The large card order is one test made of two parts: put those in AND, then OR it with membership.",
    rule: 'OR(B2="Yes",AND(C2>100,D2="Card")) is TRUE for a member, or for a card order over 100.',
    value: (e) => `This card order is over 100, so E2 should show ${e}.`,
  }),
  step("and-or-not-combining-tests", 5, 3, "Who can approve a payment", {
    prompt:
      "In E2, can this person approve payments? Managers can, and so can seniors with at least 5 years, but nobody on leave. Show TRUE or FALSE.",
    rows: [
      ["Name", "Role", "Years", "Status", "Can approve"],
      ["Kai", "Manager", 2, "Leave", null],
    ],
    cell: "E2",
    answer: '=AND(OR(B2="Manager",AND(B2="Senior",C2>=5)),D2<>"Leave")',
    required: [],
    accept: ['=IF(D2="Leave",FALSE,OR(B2="Manager",AND(B2="Senior",C2>=5)))'],
    variants: [{ D2: "Active" }, { B2: "Senior", C2: 6, D2: "Active" }],
    reject: [
      ['=OR(B2="Manager",AND(B2="Senior",C2>=5))', "value"],
      ['=AND(B2="Manager",D2<>"Leave")', "fragile"],
    ],
    nudge: "First who could approve, with OR and AND; then rule out anyone on leave.",
    rule: 'OR(B2="Manager",AND(B2="Senior",C2>=5)) covers the roles; AND with D2<>"Leave" removes anyone away.',
    value: (e) => `Kai's answer is ${e}: Kai is on leave.`,
  }),

  // ifs-more-than-two-outcomes (level 2, step 3)
  step("ifs-more-than-two-outcomes", 1, 1, "Small or large", {
    prompt:
      "In C2, show Small when the weight in B2 is under 10, and Large otherwise. Use IFS with TRUE as the last test.",
    rows: [
      ["Item", "Weight", "Size"],
      ["Box", 7, null],
    ],
    cell: "C2",
    answer: '=IFS(B2<10,"Small",TRUE,"Large")',
    required: ["IFS"],
    accept: ['=IFS(B2>=10,"Large",TRUE,"Small")'],
    variants: [{ B2: 12 }],
    reject: [['=IF(B2<10,"Small","Large")', "required-function"]],
    nudge: "IFS takes pairs: a test, then what to show when it is TRUE.",
    rule: 'TRUE as the last test catches everything else, so IFS(B2<10,"Small",TRUE,"Large") always gives an answer.',
    value: (e) => `The box weighs 7, so C2 should show ${e}.`,
  }),
  step("ifs-more-than-two-outcomes", 2, 2, "Gold, Silver or Bronze", {
    prompt:
      "In C2, band the customer: spending of 1,000 or more is Gold, 500 or more Silver, anything lower Bronze. Use IFS.",
    rows: [
      ["Customer", "Spent", "Band"],
      ["Ola", 750, null],
    ],
    cell: "C2",
    answer: '=IFS(B2>=1000,"Gold",B2>=500,"Silver",TRUE,"Bronze")',
    required: ["IFS"],
    accept: ['=IFS(B2<500,"Bronze",B2<1000,"Silver",TRUE,"Gold")'],
    variants: [{ B2: 1000 }, { B2: 300 }],
    reject: [
      ['=IFS(B2>=500,"Silver",B2>=1000,"Gold",TRUE,"Bronze")', "fragile"],
      ['=IFS(B2>1000,"Gold",B2>500,"Silver",TRUE,"Bronze")', "fragile"],
    ],
    nudge: "Test the highest band first, so a big spender does not stop at Silver.",
    rule: "IFS stops at the first TRUE test, so the tests go from the highest band down.",
    value: (e) => `Ola spent 750, so C2 should show ${e}.`,
  }),
  step("ifs-more-than-two-outcomes", 4, 2, "Postage by weight", {
    prompt:
      "Postage is 3.50 up to 1 kg, 6 up to 5 kg, 12 up to 20 kg and 25 above that. In C2, work out the postage for the weight in B2. Use IFS.",
    rows: [
      ["Parcel", "Weight", "Postage"],
      ["P-4", 4.2, null],
    ],
    cell: "C2",
    answer: "=IFS(B2<=1,3.5,B2<=5,6,B2<=20,12,TRUE,25)",
    required: ["IFS"],
    accept: ["=IFS(B2>20,25,B2>5,12,B2>1,6,TRUE,3.5)"],
    variants: [{ B2: 0.8 }, { B2: 20 }, { B2: 30 }],
    reject: [
      ["=IFS(B2<=20,12,B2<=5,6,B2<=1,3.5,TRUE,25)", "value"],
      ["=IFS(B2<1,3.5,B2<5,6,B2<20,12,TRUE,25)", "fragile"],
    ],
    nudge: "Start from the lightest band and work up.",
    rule: "With tests that use <=, the smallest limit comes first; IFS stops at the first one that is TRUE.",
    value: (e) => `A 4.2 kg parcel costs ${e}.`,
  }),
  step("ifs-more-than-two-outcomes", 5, 3, "Order cost with volume prices", {
    prompt:
      "In C2, what does an order of B2 units cost? Each unit is 5.00 for 1 to 9 units, 4.50 for 10 to 49 and 4.00 for 50 or more.",
    rows: [
      ["Order", "Units", "Cost"],
      ["O-3", 24, null],
    ],
    cell: "C2",
    answer: "=B2*IFS(B2>=50,4,B2>=10,4.5,TRUE,5)",
    required: [],
    accept: ["=B2*IF(B2>=50,4,IF(B2>=10,4.5,5))", "=IFS(B2>=50,B2*4,B2>=10,B2*4.5,TRUE,B2*5)"],
    variants: [{ B2: 50 }, { B2: 9 }, { B2: 10 }],
    reject: [
      ["=B2*4.5", "fragile"],
      ["=B2*IFS(B2>50,4,B2>10,4.5,TRUE,5)", "fragile"],
    ],
    nudge: "Pick the unit price from the number of units, then multiply.",
    rule: "IFS picks the unit price, highest volume first; multiplying by B2 gives the cost.",
    value: (e) => `24 units cost ${e}: each at 4.50.`,
  }),

  // switch-match-a-list-of-values (level 2, step 3)
  step("switch-match-a-list-of-values", 1, 1, "Turn Y and N into words", {
    prompt: "In C2, turn Y into Yes and N into No; anything else is Unknown. Use SWITCH.",
    rows: [
      ["Question", "Code", "Answer"],
      ["Agree?", "N", null],
    ],
    cell: "C2",
    answer: '=SWITCH(B2,"Y","Yes","N","No","Unknown")',
    required: ["SWITCH"],
    accept: ['=SWITCH(B2,"N","No","Y","Yes","Unknown")'],
    variants: [{ B2: "Y" }, { B2: "?" }],
    reject: [['=IF(B2="Y","Yes","No")', "required-function"]],
    nudge: "SWITCH takes the cell, then pairs of value and result, then a fallback.",
    rule: 'SWITCH(B2,"Y","Yes","N","No","Unknown") matches B2 against each value in turn.',
    value: (e) => `The code is N, so C2 should show ${e}.`,
  }),
  step("switch-match-a-list-of-values", 2, 2, "Day number to day name", {
    prompt:
      "In C2, turn the day number in B2 into its short name: 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat, 7 Sun. Use SWITCH.",
    rows: [
      ["Shift", "Day", "Name"],
      ["S-1", 3, null],
    ],
    cell: "C2",
    answer: '=SWITCH(B2,1,"Mon",2,"Tue",3,"Wed",4,"Thu",5,"Fri",6,"Sat",7,"Sun")',
    required: ["SWITCH"],
    accept: ['=SWITCH(B2,1,"Mon",2,"Tue",3,"Wed",4,"Thu",5,"Fri",6,"Sat",7,"Sun","?")'],
    variants: [{ B2: 7 }, { B2: 1 }],
    reject: [['=SWITCH(B2,1,"Mon",2,"Tue")', "value"]],
    nudge: "List every day number with its name.",
    rule: "Numbers in SWITCH need no quotes; the names do.",
    value: (e) => `Day 3 is ${e}.`,
  }),
  step("switch-match-a-list-of-values", 4, 2, "Shipping rate by region", {
    prompt:
      "Shipping is a share of the order: EU 5%, US 8%, UK 3%, anywhere else 10%. In D2, work out the shipping for the order in B2 to the region in C2. Use SWITCH.",
    rows: [
      ["Order", "Value", "Region", "Shipping"],
      ["O-11", 200, "US", null],
    ],
    cell: "D2",
    answer: '=B2*SWITCH(C2,"EU",5%,"US",8%,"UK",3%,10%)',
    required: ["SWITCH"],
    accept: ['=SWITCH(C2,"EU",B2*5%,"US",B2*8%,"UK",B2*3%,B2*10%)'],
    variants: [{ C2: "UK" }, { C2: "JP" }],
    reject: [
      ['=SWITCH(C2,"EU",5%,"US",8%,"UK",3%,10%)', "value"],
      ["=B2*8%", "required-function"],
    ],
    nudge: "SWITCH picks the rate; multiply the order by it.",
    rule: "The last value in SWITCH, 10%, is the fallback for any other region.",
    value: (e) => `Shipping to the US on 200 is ${e}.`,
  }),
  step("switch-match-a-list-of-values", 5, 3, "Next step for an overdue invoice", {
    prompt:
      "In C2, what should happen to this invoice? Over 90 days overdue: Escalate. Over 30: Remind. Over 0: Wait. Otherwise: None.",
    rows: [
      ["Invoice", "Days overdue", "Action"],
      ["INV-22", 45, null],
    ],
    cell: "C2",
    answer: '=SWITCH(TRUE,B2>90,"Escalate",B2>30,"Remind",B2>0,"Wait","None")',
    required: [],
    accept: ['=IFS(B2>90,"Escalate",B2>30,"Remind",B2>0,"Wait",TRUE,"None")'],
    variants: [{ B2: 120 }, { B2: 30 }, { B2: 0 }],
    reject: [
      ['=IF(B2>30,"Remind","Wait")', "fragile"],
      ['=SWITCH(TRUE,B2>0,"Wait",B2>30,"Remind",B2>90,"Escalate","None")', "value"],
    ],
    nudge: "Check the longest delay first and work down.",
    rule: 'SWITCH(TRUE, test, result, ...) returns the result of the first test that is TRUE, with "None" as the fallback.',
    value: (e) => `45 days overdue means ${e}.`,
  }),

  // isblank-isnumber-istext (level 2, step 3)
  step("isblank-isnumber-istext", 1, 1, "Is it a number", {
    prompt: "In C2, answer TRUE when the reading in B2 is a number. Use ISNUMBER.",
    rows: [
      ["Meter", "Reading", "A number?"],
      ["M-1", 42, null],
    ],
    cell: "C2",
    answer: "=ISNUMBER(B2)",
    required: ["ISNUMBER"],
    accept: ["=isnumber(b2)"],
    variants: [{ B2: "n/a" }],
    reject: [["=ISTEXT(B2)", "required-function"]],
    nudge: "ISNUMBER looks at what kind of value the cell holds.",
    rule: "ISNUMBER(B2) is TRUE for a number and FALSE for text or an empty cell.",
    value: (e) => `B2 holds 42, so C2 should show ${e}.`,
  }),
  step("isblank-isnumber-istext", 2, 1, "Is it text", {
    prompt: "In C2, answer TRUE when the amount in B2 is text, such as a note. Use ISTEXT.",
    rows: [
      ["Order", "Amount", "Text?"],
      ["A-102", "pending", null],
    ],
    cell: "C2",
    answer: "=ISTEXT(B2)",
    required: ["ISTEXT"],
    accept: ["=istext(b2)"],
    variants: [{ B2: 120 }],
    reject: [["=ISNUMBER(B2)", "required-function"]],
    nudge: "ISTEXT is TRUE when the cell holds words.",
    rule: "ISTEXT(B2) is TRUE for text and FALSE for numbers and empty cells.",
    value: (e) => `B2 holds the word pending, so C2 should show ${e}.`,
  }),
  step("isblank-isnumber-istext", 4, 2, "Flag a missing email", {
    prompt:
      "In D2, show Missing when the email in C2 is empty, and OK when it is not. Use IF and ISBLANK.",
    rows: [
      ["Name", "Phone", "Email", "Check"],
      ["Ben", "0711 223", null, null],
    ],
    cell: "D2",
    answer: '=IF(ISBLANK(C2),"Missing","OK")',
    required: ["IF", "ISBLANK"],
    accept: ['=IF(NOT(ISBLANK(C2)),"OK","Missing")'],
    variants: [{ C2: "ben@mail.com" }],
    reject: [
      ['=IF(C2="","Missing","OK")', "required-function"],
      ['=IF(ISBLANK(B2),"Missing","OK")', "value"],
    ],
    nudge: "ISBLANK goes inside IF as its test.",
    rule: 'IF(ISBLANK(C2),"Missing","OK") checks the email cell only.',
    value: (e) => `Ben has no email, so D2 should show ${e}.`,
  }),
  step("isblank-isnumber-istext", 5, 3, "Rows with a code but no amount", {
    prompt: "In E2, how many rows have a code in column A but no real number in column B?",
    rows: [
      ["Code", "Amount", null, null, null],
      ["C-01", 120, null, null, null],
      ["C-02", "n/a", null, null, null],
      ["C-03", 85, null, null, null],
      ["C-04", null, null, null, null],
      [null, null, null, null, null],
      ["C-06", 140, null, null, null],
      ["C-07", "pending", null, null, null],
      ["C-08", 64, null, null, null],
      [null, "note", null, null, null],
      ["C-10", 210, null, null, null],
      ["C-11", null, null, null, null],
      ["C-12", 95, null, null, null],
      ["C-13", 33, null, null, null],
      ["C-14", "tbc", null, null, null],
      ["C-15", 77, null, null, null],
    ].map((r, i) => (i === 1 ? [r[0], r[1], null, "Code, no amount", null] : r)),
    cell: "E2",
    answer: '=SUMPRODUCT((A2:A16<>"")*NOT(ISNUMBER(B2:B16)))',
    required: [],
    accept: [
      '=SUMPRODUCT(--(A2:A16<>""),--NOT(ISNUMBER(B2:B16)))',
      '=COUNTA(A2:A16)-COUNTIFS(A2:A16,"<>",B2:B16,">-1E+300")',
    ],
    variants: [{ B3: 50 }, { A6: "C-05" }],
    reject: [
      ["=COUNTA(B2:B16)-COUNT(B2:B16)", "value"],
      ["=ROWS(B2:B16)-COUNT(B2:B16)", "value"],
    ],
    nudge: "Each row passes two tests: a code is there, and the amount is not a number.",
    rule: 'A2:A16<>"" and NOT(ISNUMBER(B2:B16)) give TRUE or FALSE per row; multiplying them keeps rows where both are TRUE, and SUMPRODUCT counts them.',
    value: (e) => `${e} rows have a code but no amount. Rows without a code do not count.`,
  }),

  // logical-functions-summary (level 3, step 4)
  step("logical-functions-summary", 1, 1, "OK or LOW", {
    prompt: "In C2, show OK when the units in B2 are at least 15, and LOW otherwise. Use IF.",
    rows: [
      ["Item", "Units", "Check"],
      ["Bolt", 12, null],
    ],
    cell: "C2",
    answer: '=IF(B2>=15,"OK","LOW")',
    required: ["IF"],
    accept: ['=IF(B2<15,"LOW","OK")'],
    variants: [{ B2: 15 }],
    reject: [['=IF(B2>15,"OK","LOW")', "fragile"]],
    nudge: "At least 15 includes 15 itself.",
    rule: 'IF(B2>=15,"OK","LOW") shows OK at 15 or more.',
    value: (e) => `12 units is below 15, so C2 should show ${e}.`,
  }),
  step("logical-functions-summary", 2, 2, "Alert when any item runs low", {
    prompt:
      "In B9, show ALERT when any item has fewer than 10 units, and OK otherwise. Use IF and MIN.",
    rows: [
      ["Item", "Units"],
      ["Bolt", 18],
      ["Nut", 22],
      ["Washer", 8],
      ["Screw", 30],
      ["Clip", 24],
      ["Pin", 31],
      [null, null],
      ["Stock check", null],
    ],
    cell: "B9",
    answer: '=IF(MIN(B2:B7)<10,"ALERT","OK")',
    required: ["IF", "MIN"],
    accept: ['=IF(MIN(B2:B7)>=10,"OK","ALERT")'],
    variants: [{ B4: 12 }, { B7: 5, B4: 12 }],
    reject: [
      ['=IF(B4<10,"ALERT","OK")', "required-function"],
      ['=IF(MIN(B2:B6)<10,"ALERT","OK")', "fragile"],
    ],
    nudge: "If the smallest stock is under 10, at least one item is low.",
    rule: 'MIN(B2:B7) is the lowest stock; IF(MIN(B2:B7)<10,"ALERT","OK") raises the alert.',
    value: (e) => `The washers are down to 8, so B9 should show ${e}.`,
  }),
  step("logical-functions-summary", 3, 2, "Average price, or none", {
    prompt:
      "In D9, show the average of the prices in C2 to C7, rounded to 2 decimals, or the word none when no price has been entered. Use IF, COUNT, ROUND and AVERAGE.",
    rows: [
      ["Item", "Units", "Price", "Answer"],
      ["Bolt", 18, 4.55, null],
      ["Nut", 22, null, null],
      ["Washer", 25, 4.2, null],
      ["Screw", 30, 5.15, null],
      ["Clip", 24, null, null],
      ["Pin", 31, 4.85, null],
      [null, null, null, null],
      ["Average price", null, null, null],
    ],
    cell: "D9",
    answer: '=IF(COUNT(C2:C7)=0,"none",ROUND(AVERAGE(C2:C7),2))',
    required: ["IF", "COUNT", "ROUND", "AVERAGE"],
    accept: ['=IF(COUNT(C2:C7)>0,ROUND(AVERAGE(C2:C7),2),"none")'],
    variants: [{ C3: 3.9 }],
    reject: [
      ['=IF(COUNT(C2:C7)=0,"none",ROUND(AVERAGE(C2:C7),1))', "value"],
      ['=IF(COUNT(C2:C7)=0,"none",AVERAGE(C2:C7))', "required-function"],
    ],
    nudge: "Test for any prices first, then round the average.",
    rule: "COUNT(C2:C7)=0 catches a list with no prices; otherwise ROUND(AVERAGE(C2:C7),2) gives the average to 2 decimals.",
    value: (e) => `The average of the four prices, to 2 decimals, is ${e}.`,
  }),
  step("logical-functions-summary", 5, 3, "Reorder flags for every item", {
    prompt:
      "In E2, for every item at once, show REORDER when its stock is below its reorder level and it is not discontinued, and OK otherwise.",
    rows: [
      ["Item", "Stock", "Reorder at", "Discontinued", "Action"],
      ["Bolt", 12, 20, "No", null],
      ["Nut", 40, 25, "No", null],
      ["Washer", 8, 15, "Yes", null],
      ["Screw", 18, 30, "No", null],
      ["Clip", 26, 20, "No", null],
      ["Pin", 5, 10, "No", null],
    ],
    cell: "E2",
    answer: '=IF((B2:B7<C2:C7)*(D2:D7<>"Yes"),"REORDER","OK")',
    required: [],
    accept: ['=IF((B2:B7<C2:C7)*(D2:D7="No"),"REORDER","OK")'],
    variants: [{ D4: "No" }, { B6: 15 }],
    reject: [
      ['=IF(B2:B7<C2:C7,"REORDER","OK")', "value"],
      ['=IF(B2<C2,"REORDER","OK")', "value"],
    ],
    nudge: "Compare whole columns at once; multiplying two tests works like AND row by row.",
    rule: '(B2:B7<C2:C7)*(D2:D7<>"Yes") is 1 only where both tests pass, so IF spills REORDER or OK for each item.',
    value: () =>
      "Each item needs its own answer: REORDER only when stock is below the level and it is still sold.",
  }),
];
