// Ladder steps for the "interview-fpa" track (docs/content.md, Ladder steps). The
// YAML files are the source of truth once written: variants added later by
// tools/suggest-variants.ts and by hand live only there, so do not --write this again.
// Each exercise's own slot: level 2 at step 3, level 3 at step 4.
const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(3));
const step = (parent, n, level, title, screen) => ({
  parent,
  step: n,
  level,
  title,
  screens: [screen],
});

const months = [
  ["Month", "Actual", "Budget", "Months closed", null],
  [1, 41200, 40000, 4, null],
  [2, 39800, 40000, null, null],
  [3, 43500, 42000, null, null],
  [4, 44100, 42000, null, null],
  [5, null, 44000, null, null],
  [6, null, 44000, null, null],
  [7, null, 45000, null, null],
  [8, null, 43000, null, null],
  [9, null, 46000, null, null],
  [10, null, 47000, null, null],
  [11, null, 48000, null, null],
  [12, null, 52000, null, null],
];
const runRate = [
  ["Month", "Actual", "Months closed", null, null],
  [1, 41200, 5, null, null],
  [2, 39800, null, null, null],
  [3, 43500, null, null, null],
  [4, 44100, null, null, null],
  [5, 45600, null, null, null],
];
const costs = [
  ["Department", "Cost type", "Amount", null, null, null],
  ["Marketing", "Salaries", 84000, null, null, null],
  ["Marketing", "Software", 12500, null, null, null],
  ["Sales", "Salaries", 126000, null, null, null],
  ["Sales", "Software", 9800, null, null, null],
  ["IT", "Salaries", 98000, null, null, null],
  ["IT", "Software", 41000, null, null, null],
  ["Marketing", "Travel", 7400, null, null, null],
  ["Sales", "Travel", 18200, null, null, null],
  ["IT", "Travel", 3100, null, null, null],
];
const plan = [
  ["Team", "Grade", "Heads", "Cost per head", null, null, null],
  ["Sales", "Junior", 6, 38000, null, null, null],
  ["Sales", "Senior", 3, 62000, null, null, null],
  ["IT", "Junior", 4, 45000, null, null, null],
  ["IT", "Senior", 2, 78000, null, null, null],
  ["Ops", "Junior", 5, 34000, null, null, null],
];
const quarters = [
  ["Month", "Quarter", "Forecast", "Budget", null, null],
  [1, "Q1", 41000, 40000, null, null],
  [2, "Q1", 39500, 40000, null, null],
  [3, "Q1", 43000, 42000, null, null],
  [4, "Q2", 44500, 42000, null, null],
  [5, "Q2", 43000, 44000, null, null],
  [6, "Q2", 46500, 44000, null, null],
  [7, "Q3", 45500, 45000, null, null],
  [8, "Q3", 42000, 43000, null, null],
  [9, "Q3", 47500, 46000, null, null],
  [10, "Q4", 48000, 47000, null, null],
  [11, "Q4", 50500, 48000, null, null],
  [12, "Q4", 51000, 52000, null, null],
];

export default [
  // year-to-date-actual-against-budget (level 2, step 3)
  step("year-to-date-actual-against-budget", 1, 1, "Actual for the closed months", {
    prompt: "In E2, add up the actuals for the four closed months, B2 to B5. Use SUM.",
    rows: months,
    cell: "E2",
    answer: "=SUM(B2:B5)",
    required: ["SUM"],
    accept: ["=SUM($B$2:$B$5)"],
    variants: [{ B3: 41000 }],
    reject: [["=SUM(C2:C5)", "value"]],
    nudge: "SUM the actual column for months 1 to 4.",
    rule: "SUM(B2:B5) is the actual so far this year.",
    value: (e) => `The actual to date is ${e}.`,
  }),
  step("year-to-date-actual-against-budget", 2, 2, "Actual to date from a cell", {
    prompt: "In E2, add up the actuals for the months up to the number closed in D2. Use SUMIF.",
    rows: months,
    cell: "E2",
    answer: '=SUMIF(A2:A13,"<="&D2,B2:B13)',
    required: ["SUMIF"],
    accept: ['=SUMIF($A$2:$A$13,"<="&$D$2,$B$2:$B$13)'],
    variants: [{ D2: 3 }],
    reject: [
      ['=SUMIF(A2:A13,"<"&D2,B2:B13)', "value"],
      ['=SUMIF(A2:A13,"<=4",B2:B13)', "fragile"],
    ],
    nudge: 'Build the test from D2: "<="&D2.',
    rule: 'SUMIF(A2:A13,"<="&D2,B2:B13) follows the months closed as the year goes on.',
    value: (e) => `The actual to date is ${e}.`,
  }),
  step("year-to-date-actual-against-budget", 4, 2, "Actual to date as a share of budget", {
    prompt:
      "In E2, show the year-to-date actual as a share of the year-to-date budget, for the months up to D2. Use SUMIFS.",
    rows: months,
    cell: "E2",
    answer: '=SUMIFS(B2:B13,A2:A13,"<="&D2)/SUMIFS(C2:C13,A2:A13,"<="&D2)',
    required: ["SUMIFS"],
    accept: ['=SUMIFS($B$2:$B$13,$A$2:$A$13,"<="&$D$2)/SUMIFS($C$2:$C$13,$A$2:$A$13,"<="&$D$2)'],
    variants: [{ D2: 2 }],
    reject: [
      ['=SUMIFS(B2:B13,A2:A13,"<="&D2)/SUM(C2:C13)', "value"],
      ['=SUMIFS(C2:C13,A2:A13,"<="&D2)/SUMIFS(B2:B13,A2:A13,"<="&D2)', "value"],
    ],
    nudge: "Both totals use the same months-closed test.",
    rule: "Comparing like with like: only the budget for the closed months goes below the line.",
    value: (e) => `The actual is ${fmt(e)} of the budget so far.`,
  }),
  step("year-to-date-actual-against-budget", 5, 3, "Full-year outlook", {
    prompt:
      "In E2, what is the full-year outlook: the actuals for the months closed, as D2 says, plus the budget for the months still to come?",
    rows: months,
    cell: "E2",
    answer: '=SUMIFS(B2:B13,A2:A13,"<="&D2)+SUMIFS(C2:C13,A2:A13,">"&D2)',
    required: [],
    accept: ['=SUMIF(A2:A13,"<="&D2,B2:B13)+SUMIF(A2:A13,">"&D2,C2:C13)'],
    variants: [{ D2: 3 }, { C10: 50000 }],
    reject: [
      ["=SUM(B2:B13)+SUM(C2:C13)", "value"],
      ['=SUMIFS(B2:B13,A2:A13,"<="&D2)+SUMIFS(C2:C13,A2:A13,">="&D2)', "value"],
    ],
    nudge: "Actuals where a month is closed, budget where it is not.",
    rule: "Two SUMIFS split the year at D2: <= for the closed months, > for the rest.",
    value: (e) => `The full-year outlook is ${e}.`,
  }),

  // full-year-forecast-from-the-run-rate (level 2, step 3)
  step("full-year-forecast-from-the-run-rate", 1, 1, "Average month so far", {
    prompt: "In D2, work out the average month so far, B2 to B6. Use AVERAGE.",
    rows: runRate,
    cell: "D2",
    answer: "=AVERAGE(B2:B6)",
    required: ["AVERAGE"],
    accept: ["=AVERAGE($B$2:$B$6)"],
    variants: [{ B4: 40000 }],
    reject: [["=SUM(B2:B6)", "required-function"]],
    nudge: "AVERAGE of the closed months.",
    rule: "AVERAGE(B2:B6) is the run rate per month.",
    value: (e) => `The average month is ${e}.`,
  }),
  step("full-year-forecast-from-the-run-rate", 2, 2, "Annualised run rate", {
    prompt: "In D2, annualise the run rate: the average month so far times 12. Use AVERAGE.",
    rows: runRate,
    cell: "D2",
    answer: "=AVERAGE(B2:B6)*12",
    required: ["AVERAGE"],
    accept: ["=12*AVERAGE(B2:B6)"],
    variants: [{ B6: 48000 }],
    reject: [["=SUM(B2:B6)*12", "required-function"]],
    nudge: "The average month, twelve times.",
    rule: "AVERAGE(B2:B6)*12 assumes every month of the year looks like the average so far.",
    value: (e) => `The annualised run rate is ${e}.`,
  }),
  step("full-year-forecast-from-the-run-rate", 4, 2, "Forecast from the latest month", {
    prompt:
      "In D2, forecast the full year as the actual to date plus the latest month, B6, for each month left. Use SUM.",
    rows: runRate,
    cell: "D2",
    answer: "=SUM(B2:B6)+B6*(12-C2)",
    required: ["SUM"],
    accept: ["=SUM(B2:B6)+(12-C2)*B6"],
    variants: [{ B6: 47000 }, { C2: 6 }],
    reject: [
      ["=SUM(B2:B6)+B6*12", "value"],
      ["=SUM(B2:B6)+B6*7", "fragile"],
    ],
    nudge: "The months left are 12 minus the months closed in C2.",
    rule: "SUM(B2:B6) is the year so far; B6*(12-C2) repeats the latest month for the rest.",
    value: (e) => `The forecast is ${e}.`,
  }),
  step("full-year-forecast-from-the-run-rate", 5, 3, "Forecast from the last few months", {
    prompt:
      "In D2, forecast the full year as the actual to date plus, for each month left, the average of the last E1 closed months.",
    rows: runRate.map((r, i) => (i === 0 ? [...r.slice(0, 4), 2] : r)),
    cell: "D2",
    answer: "=SUM(B2:B6)+AVERAGE(TAKE(B2:B6,-E1))*(12-C2)",
    required: [],
    accept: ["=SUM(B2:B6)+(12-C2)*AVERAGE(TAKE(B2:B6,-E1))"],
    variants: [{ E1: 3 }, { B5: 46000 }],
    reject: [
      ["=SUM(B2:B6)+AVERAGE(B2:B6)*(12-C2)", "value"],
      ["=SUM(B2:B6)+AVERAGE(B5:B6)*(12-C2)", "fragile"],
    ],
    nudge: "TAKE with a negative count keeps the last rows of a list.",
    rule: "TAKE(B2:B6,-E1) is the last E1 months; their average is the run rate for the months left.",
    value: (e) => `The forecast is ${e}.`,
  }),

  // department-cost-roll-up (level 2, step 3)
  step("department-cost-roll-up", 1, 1, "Total cost of one department", {
    prompt: "In E2, total the cost of the Marketing department. Use SUMIF.",
    rows: costs.map((r, i) => (i === 0 ? [...r.slice(0, 4), "Marketing total", null] : r)),
    cell: "E2",
    answer: '=SUMIF(A2:A10,"Marketing",C2:C10)',
    required: ["SUMIF"],
    accept: ['=SUMIF($A$2:$A$10,"Marketing",$C$2:$C$10)'],
    variants: [{ C3: 15000 }],
    reject: [['=SUMIF(A2:A10,"Sales",C2:C10)', "value"]],
    nudge: "Test the department column, add the amount column.",
    rule: 'SUMIF(A2:A10,"Marketing",C2:C10) adds every Marketing cost.',
    value: (e) => `Marketing costs ${e}.`,
  }),
  step("department-cost-roll-up", 2, 2, "Department and cost type from cells", {
    prompt: "In F3, total the cost for the department in F1 and the cost type in F2. Use SUMIFS.",
    rows: costs.map((r, i) =>
      i === 0 ? [...r.slice(0, 5), "IT"] : i === 1 ? [...r.slice(0, 5), "Travel"] : r,
    ),
    cell: "F3",
    answer: "=SUMIFS(C2:C10,A2:A10,F1,B2:B10,F2)",
    required: ["SUMIFS"],
    accept: ["=SUMIFS(C2:C10,B2:B10,F2,A2:A10,F1)"],
    variants: [{ F1: "Sales" }, { F2: "Software" }],
    reject: [['=SUMIFS(C2:C10,A2:A10,"IT",B2:B10,"Travel")', "fragile"]],
    nudge: "Point each condition at its cell.",
    rule: "SUMIFS(C2:C10,A2:A10,F1,B2:B10,F2) follows whatever is typed in F1 and F2.",
    value: (e) => `IT travel costs ${e}.`,
  }),
  step("department-cost-roll-up", 4, 2, "Salaries as a share of all costs", {
    prompt:
      "In E2, show salaries as a share of all costs, rounded to two decimal places. Use SUMIF, SUM and ROUND.",
    rows: costs.map((r, i) => (i === 0 ? [...r.slice(0, 4), "Salary share", null] : r)),
    cell: "E2",
    answer: '=ROUND(SUMIF(B2:B10,"Salaries",C2:C10)/SUM(C2:C10),2)',
    required: ["SUMIF", "SUM", "ROUND"],
    accept: ['=ROUND(SUMIF($B$2:$B$10,"Salaries",$C$2:$C$10)/SUM($C$2:$C$10),2)'],
    variants: [{ C7: 80000 }],
    reject: [['=ROUND(SUMIF(B2:B10,"Salaries",C2:C10)/SUM(C2:C10),1)', "value"]],
    nudge: "Salaries over the total, then round.",
    rule: "SUMIF picks the salary lines; SUM is every cost; ROUND keeps two decimals.",
    value: (e) => `Salaries are ${e} of all costs.`,
  }),
  step("department-cost-roll-up", 5, 3, "Department that spends most on software", {
    prompt: "In F2, which of the departments listed in E2:E4 spends the most on software?",
    rows: costs.map((r, i) =>
      i === 0
        ? [...r.slice(0, 4), "Department", "Most on software"]
        : i <= 3
          ? [...r.slice(0, 4), ["Marketing", "Sales", "IT"][i - 1], null]
          : r,
    ),
    cell: "F2",
    answer:
      '=XLOOKUP(MAX(SUMIFS(C2:C10,A2:A10,E2:E4,B2:B10,"Software")),SUMIFS(C2:C10,A2:A10,E2:E4,B2:B10,"Software"),E2:E4)',
    required: [],
    accept: [
      '=INDEX(E2:E4,MATCH(MAX(SUMIFS(C2:C10,A2:A10,E2:E4,B2:B10,"Software")),SUMIFS(C2:C10,A2:A10,E2:E4,B2:B10,"Software"),0))',
    ],
    variants: [{ C3: 50000 }, { C5: 45000 }],
    reject: [
      ["=XLOOKUP(MAX(SUMIFS(C2:C10,A2:A10,E2:E4)),SUMIFS(C2:C10,A2:A10,E2:E4),E2:E4)", "value"],
      ['="IT"', "reference"],
    ],
    nudge: "Total each department's software at once, then find the largest.",
    rule: "SUMIFS with E2:E4 as a criteria list gives one software total per department; MAX and XLOOKUP name the biggest.",
    value: (e) => `${e} spends the most on software.`,
  }),

  // headcount-cost-plan (level 3, step 4)
  step("headcount-cost-plan", 1, 1, "Total heads in the plan", {
    prompt: "In F2, total the heads in the plan. Use SUM.",
    rows: plan.map((r, i) => (i === 0 ? [...r.slice(0, 5), "Heads", null] : r)),
    cell: "F2",
    answer: "=SUM(C2:C6)",
    required: ["SUM"],
    accept: ["=SUM($C$2:$C$6)"],
    variants: [{ C3: 4 }],
    reject: [["=SUM(D2:D6)", "value"]],
    nudge: "SUM the Heads column.",
    rule: "SUM(C2:C6) gives every head in the plan.",
    value: (e) => `The plan has ${e} heads.`,
  }),
  step("headcount-cost-plan", 2, 2, "Heads in one team", {
    prompt: "In G2, total the heads in the team typed in G1. Use SUMIF.",
    rows: plan.map((r, i) => (i === 0 ? [...r.slice(0, 6), "IT"] : r)),
    cell: "G2",
    answer: "=SUMIF(A2:A6,G1,C2:C6)",
    required: ["SUMIF"],
    accept: ["=SUMIF($A$2:$A$6,$G$1,$C$2:$C$6)"],
    variants: [{ G1: "Sales" }],
    reject: [['=SUMIF(A2:A6,"IT",C2:C6)', "fragile"]],
    nudge: "Test the team column against G1, add the heads.",
    rule: "SUMIF(A2:A6,G1,C2:C6) totals whichever team is in G1.",
    value: (e) => `IT has ${e} heads.`,
  }),
  step("headcount-cost-plan", 3, 2, "Cost of the senior roles", {
    prompt:
      'In F2, total the cost of the senior roles: (B2:B6="Senior") times heads times cost per head. Use SUMPRODUCT.',
    rows: plan.map((r, i) => (i === 0 ? [...r.slice(0, 5), "Senior cost", null] : r)),
    cell: "F2",
    answer: '=SUMPRODUCT((B2:B6="Senior")*C2:C6*D2:D6)',
    required: ["SUMPRODUCT"],
    accept: ['=SUMPRODUCT(--(B2:B6="Senior"),C2:C6,D2:D6)'],
    variants: [{ C5: 3 }],
    reject: [["=SUMPRODUCT(C2:C6,D2:D6)", "value"]],
    nudge: "The test keeps the senior rows; heads times cost gives each row's cost.",
    rule: '(B2:B6="Senior") is 1 only on senior rows, so only they count.',
    value: (e) => `Senior roles cost ${e}.`,
  }),
  step("headcount-cost-plan", 5, 3, "Plan cost after extra junior hires", {
    prompt:
      "In F2, what does the plan cost after hiring the number of extra juniors in G1, each at the junior cost of the Sales team?",
    rows: plan.map((r, i) => (i === 0 ? [...r.slice(0, 5), "Plan cost", 3] : r)),
    cell: "F2",
    answer: '=SUMPRODUCT(C2:C6,D2:D6)+G1*SUMIFS(D2:D6,A2:A6,"Sales",B2:B6,"Junior")',
    required: [],
    accept: ['=SUMPRODUCT(C2:C6,D2:D6)+G1*XLOOKUP(1,(A2:A6="Sales")*(B2:B6="Junior"),D2:D6)'],
    variants: [{ G1: 5 }, { D2: 40000 }],
    reject: [
      ["=SUMPRODUCT(C2:C6,D2:D6)+G1", "value"],
      ["=SUMPRODUCT(C2:C6,D2:D6)+G1*D4", "value"],
    ],
    nudge: "The current plan, plus the new heads times the Sales junior cost.",
    rule: "SUMIFS on team and grade finds the Sales junior cost wherever its row sits.",
    value: (e) => `The plan will cost ${e}.`,
  }),

  // quarter-forecast-against-budget (level 2, step 3)
  step("quarter-forecast-against-budget", 1, 1, "Forecast for one quarter", {
    prompt: "In F2, total the Q1 forecast. Use SUMIF.",
    rows: quarters.map((r, i) => (i === 0 ? [...r.slice(0, 5), "Q1 forecast"] : r)),
    cell: "F2",
    answer: '=SUMIF(B2:B13,"Q1",C2:C13)',
    required: ["SUMIF"],
    accept: ['=SUMIF($B$2:$B$13,"Q1",$C$2:$C$13)'],
    variants: [{ C3: 41000 }],
    reject: [['=SUMIF(B2:B13,"Q1",D2:D13)', "value"]],
    nudge: "Test the quarter column, add the forecast.",
    rule: 'SUMIF(B2:B13,"Q1",C2:C13) adds the three Q1 months.',
    value: (e) => `The Q1 forecast is ${e}.`,
  }),
  step("quarter-forecast-against-budget", 2, 2, "Variance for the quarter in a cell", {
    prompt: "In F2, show the forecast minus the budget for the quarter typed in F1. Use SUMIFS.",
    rows: quarters.map((r, i) => (i === 0 ? [...r.slice(0, 5), "Q3"] : r)),
    cell: "F2",
    answer: "=SUMIFS(C2:C13,B2:B13,F1)-SUMIFS(D2:D13,B2:B13,F1)",
    required: ["SUMIFS"],
    accept: ["=SUMIFS($C$2:$C$13,$B$2:$B$13,$F$1)-SUMIFS($D$2:$D$13,$B$2:$B$13,$F$1)"],
    variants: [{ F1: "Q4" }],
    reject: [['=SUMIFS(C2:C13,B2:B13,"Q3")-SUMIFS(D2:D13,B2:B13,"Q3")', "fragile"]],
    nudge: "Two SUMIFS on the same quarter, one per column.",
    rule: "Forecast minus budget for the quarter in F1; positive means over.",
    value: (e) => `Q3 is ${e} against budget.`,
  }),
  step("quarter-forecast-against-budget", 4, 2, "Quarter variance as a share", {
    prompt:
      "In F2, show the Q2 variance as a share of the Q2 budget, rounded to three decimals. Use SUMIFS and ROUND.",
    rows: quarters.map((r, i) => (i === 0 ? [...r.slice(0, 5), "Q2 variance %"] : r)),
    cell: "F2",
    answer:
      '=ROUND((SUMIFS(C2:C13,B2:B13,"Q2")-SUMIFS(D2:D13,B2:B13,"Q2"))/SUMIFS(D2:D13,B2:B13,"Q2"),3)',
    required: ["SUMIFS", "ROUND"],
    accept: [
      '=ROUND((SUMIFS($C$2:$C$13,$B$2:$B$13,"Q2")-SUMIFS($D$2:$D$13,$B$2:$B$13,"Q2"))/SUMIFS($D$2:$D$13,$B$2:$B$13,"Q2"),3)',
    ],
    variants: [{ C6: 41000 }],
    reject: [
      [
        '=ROUND((SUMIFS(C2:C13,B2:B13,"Q2")-SUMIFS(D2:D13,B2:B13,"Q2"))/SUMIFS(C2:C13,B2:B13,"Q2"),3)',
        "value",
      ],
    ],
    nudge: "Variance over budget, then round.",
    rule: "Dividing by the budget shows the variance in proportion to the plan.",
    value: (e) => `Q2 is ${fmt(e)} away from budget.`,
  }),
  step("quarter-forecast-against-budget", 5, 3, "Quarter with the biggest overspend", {
    prompt:
      "In G2, which quarter, from the list in F2:F5, has the biggest forecast overspend against budget?",
    rows: quarters.map((r, i) =>
      i === 0
        ? [...r.slice(0, 5), "Quarter", "Biggest over"]
        : i <= 4
          ? [...r.slice(0, 5), ["Q1", "Q2", "Q3", "Q4"][i - 1], null]
          : [...r, null],
    ),
    cell: "G2",
    answer:
      "=XLOOKUP(MAX(SUMIFS(C2:C13,B2:B13,F2:F5)-SUMIFS(D2:D13,B2:B13,F2:F5)),SUMIFS(C2:C13,B2:B13,F2:F5)-SUMIFS(D2:D13,B2:B13,F2:F5),F2:F5)",
    required: [],
    accept: [
      "=INDEX(F2:F5,MATCH(MAX(SUMIFS(C2:C13,B2:B13,F2:F5)-SUMIFS(D2:D13,B2:B13,F2:F5)),SUMIFS(C2:C13,B2:B13,F2:F5)-SUMIFS(D2:D13,B2:B13,F2:F5),0))",
    ],
    variants: [{ C9: 50000 }, { D6: 40000 }],
    reject: [
      ["=XLOOKUP(MAX(SUMIFS(C2:C13,B2:B13,F2:F5)),SUMIFS(C2:C13,B2:B13,F2:F5),F2:F5)", "value"],
      ['="Q2"', "reference"],
    ],
    nudge: "Work out every quarter's overspend at once, then find the largest.",
    rule: "Two SUMIFS with F2:F5 as criteria give each quarter's forecast and budget; their difference shows the overspend.",
    value: (e) => `The biggest overspend is in ${e}.`,
  }),
];
