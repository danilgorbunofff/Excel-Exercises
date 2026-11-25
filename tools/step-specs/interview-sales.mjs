// Ladder steps for the "interview-sales" track (docs/content.md, Ladder steps).
// The YAML files are the source of truth once written: variants added later by
// tools/suggest-variants.ts and by hand live only there, so do not --write this again.
// Each exercise's own slot: level 2 at step 3, level 3 at step 4.
const step = (parent, n, level, title, screen) => ({
  parent,
  step: n,
  level,
  title,
  screens: [screen],
});

const campaigns = [
  ["Campaign", "Leads", "Sales", null, null, null],
  ["Spring email", 1840, 97, null, null, null],
  ["Webinar", 620, 58, null, null, null],
  ["Trade show", 310, 41, null, null, null],
  ["Search ads", 2950, 112, null, null, null],
  ["Referral", 240, 36, null, null, null],
];
const regions = [
  ["Region", "Month", "Revenue", null, null, null, null],
  ["North", "Jan", 12400, null, null, null, null],
  ["South", "Jan", 9800, null, null, null, null],
  ["South", "Feb", 11250, null, null, null, null],
  ["North", "Feb", 13100, null, null, null, null],
  ["West", "Feb", 7600, null, null, null, null],
  ["South", "Feb", 4300, null, null, null, null],
  ["North", "Mar", 14800, null, null, null, null],
  ["South", "Mar", 10900, null, null, null, null],
  ["West", "Jan", 6900, null, null, null, null],
  ["South", "Feb", 2750, null, null, null, null],
];
const ads = [
  ["Campaign", "Spend", "Revenue", null, null, null],
  ["Search", 4200, 16800, null, null, null],
  ["Social", 3100, 9920, null, null, null],
  ["Email", 900, 5850, null, null, null],
  ["Video", 5600, 14560, null, null, null],
  ["Print", 1500, 3150, null, null, null],
  ["Radio", 2800, 7840, null, null, null],
  ["Display", 2000, 6600, null, null, null],
];
const customers = [
  ["Customer", "Revenue", null, null, null],
  ["Arden", 42000, null, null, null],
  ["Brook", 18500, null, null, null],
  ["Calder", 67300, null, null, null],
  ["Dene", 9200, null, null, null],
  ["Esk", 31800, null, null, null],
  ["Frome", 54100, null, null, null],
  ["Garry", 12600, null, null, null],
  ["Hull", 23400, null, null, null],
  ["Isis", 7900, null, null, null],
  ["Jed", 15200, null, null, null],
];
// Puts labels or inputs into the empty columns of a table, keyed by row index.
const fill = (rows, from, extra) => {
  const width = Math.max(
    ...rows.map((r) => r.length),
    ...Object.values(extra).map((e) => from + e.length),
  );
  return rows.map((r, i) =>
    Array.from({ length: width }, (_, j) =>
      extra[i] && j >= from && j - from < extra[i].length ? extra[i][j - from] : (r[j] ?? null),
    ),
  );
};

export default [
  // lead-conversion-rate (level 2, step 3)
  step("lead-conversion-rate", 1, 1, "Conversion as a fraction", {
    prompt:
      "In D2, work out the share of leads that became sales: the sales in C2 divided by the leads in B2.",
    rows: [
      ["Campaign", "Leads", "Sales", "Conversion"],
      ["Spring email", 1840, 97, null],
    ],
    cell: "D2",
    answer: "=C2/B2",
    required: [],
    accept: ["=C2*(1/B2)"],
    variants: [{ C2: 120 }],
    reject: [["=B2/C2", "value"]],
    nudge: "Sales over leads, not leads over sales.",
    rule: "C2/B2 is the fraction of leads that bought.",
    value: (e) => `D2 shows ${e}.`,
  }),
  step("lead-conversion-rate", 2, 1, "Conversion as a whole percentage", {
    prompt:
      "In D2, show the share of leads that became sales as a percentage rounded to a whole number. Use ROUND.",
    rows: [
      ["Campaign", "Leads", "Sales", "Conversion %"],
      ["Webinar", 620, 58, null],
    ],
    cell: "D2",
    answer: "=ROUND(C2/B2*100,0)",
    required: ["ROUND"],
    accept: ["=ROUND(100*C2/B2,0)"],
    variants: [{ C2: 75 }],
    reject: [["=ROUND(C2/B2,0)", "value"]],
    nudge: "Times 100 turns the fraction into a percentage; round after that.",
    rule: "ROUND(C2/B2*100,0) gives the percentage with no decimals.",
    value: (e) => `The webinar converted ${e}% of leads.`,
  }),
  step("lead-conversion-rate", 4, 2, "Conversion across all campaigns", {
    prompt:
      "In E2, show the conversion of all campaigns together, as a percentage rounded to one decimal place. Use SUM and ROUND.",
    rows: fill(campaigns, 3, { 0: [null, "All campaigns %"] }),
    cell: "E2",
    answer: "=ROUND(SUM(C2:C6)/SUM(B2:B6)*100,1)",
    required: ["SUM", "ROUND"],
    accept: ["=ROUND(100*SUM(C2:C6)/SUM(B2:B6),1)"],
    variants: [{ C5: 150 }],
    reject: [
      ["=ROUND(SUM(C2:C6)/SUM(B2:B6),1)", "value"],
      ["=ROUND(AVERAGE(C2:C6/B2:B6)*100,1)", "required-function"],
    ],
    nudge: "Add up all sales and all leads first, then divide.",
    rule: "Total sales over total leads weighs each campaign by its size.",
    value: (e) => `All campaigns together converted ${e}% of leads.`,
  }),
  step("lead-conversion-rate", 5, 3, "Leads needed for a sales goal", {
    prompt:
      "In F2, work out how many leads are needed to make the number of sales in F1, at the conversion of all campaigns together. Round up to a whole lead.",
    rows: fill(campaigns, 3, { 0: [null, "Sales goal", 500], 1: [null, "Leads needed", null] }),
    cell: "F2",
    answer: "=ROUNDUP(F1/(SUM(C2:C6)/SUM(B2:B6)),0)",
    required: [],
    accept: ["=ROUNDUP(F1*SUM(B2:B6)/SUM(C2:C6),0)", "=CEILING(F1*SUM(B2:B6)/SUM(C2:C6),1)"],
    variants: [{ F1: 800 }, { C5: 150 }],
    reject: [
      ["=ROUND(F1*SUM(B2:B6)/SUM(C2:C6),0)", "fragile"],
      ["=ROUNDUP(F1*SUM(C2:C6)/SUM(B2:B6),0)", "value"],
    ],
    nudge: "Leads needed is the goal divided by the conversion rate.",
    rule: "The goal over the overall rate gives the leads; ROUNDUP keeps it a whole lead that still reaches the goal.",
    value: (e) => `${e} leads are needed.`,
  }),

  // rep-target-check (level 2, step 3)
  step("rep-target-check", 1, 1, "Sales against target", {
    prompt:
      "In D2, work out how far the rep's sales in C2 are above the target in B2. A shortfall shows as a negative number.",
    rows: [
      ["Rep", "Target", "Sales", "Difference"],
      ["Nia", 52000, 50850, null],
    ],
    cell: "D2",
    answer: "=C2-B2",
    required: [],
    accept: ["=-B2+C2"],
    variants: [{ C2: 53400 }],
    reject: [["=B2-C2", "value"]],
    nudge: "Sales minus target.",
    rule: "C2-B2 is positive above target and negative below it.",
    value: (e) => `D2 shows ${e}.`,
  }),
  step("rep-target-check", 2, 1, "Percentage of target reached", {
    prompt:
      "In D2, show the rep's sales as a percentage of the target, rounded to one decimal place. Use ROUND.",
    rows: [
      ["Rep", "Target", "Sales", "% of target"],
      ["Nia", 52000, 50850, null],
    ],
    cell: "D2",
    answer: "=ROUND(C2/B2*100,1)",
    required: ["ROUND"],
    accept: ["=ROUND(100*C2/B2,1)"],
    variants: [{ C2: 53400 }],
    reject: [["=ROUND(B2/C2*100,1)", "value"]],
    nudge: "Sales over target, times 100.",
    rule: "ROUND(C2/B2*100,1) shows how much of the target was reached.",
    value: (e) => `Nia reached ${e}% of target.`,
  }),
  step("rep-target-check", 4, 2, "Above, on target or below", {
    prompt:
      "In D2, show Above when sales reach 110% of the target, On target when they reach the target, and Below otherwise. Use IF.",
    rows: [
      ["Rep", "Target", "Sales", "Check"],
      ["Nia", 52000, 50850, null],
    ],
    cell: "D2",
    answer: '=IF(C2>=B2*1.1,"Above",IF(C2>=B2,"On target","Below"))',
    required: ["IF"],
    accept: ['=IF(C2<B2,"Below",IF(C2<B2*1.1,"On target","Above"))'],
    variants: [{ C2: 58000 }, { C2: 53400 }],
    reject: [['=IF(C2>=B2,"On target",IF(C2>=B2*1.1,"Above","Below"))', "fragile"]],
    nudge: "Test the highest bar first, or On target catches everything above it.",
    rule: "Checking 110% before 100% lets each rep land in the right band.",
    value: (e) => `Nia's check shows ${e}.`,
  }),
  step("rep-target-check", 5, 3, "How many reps hit target", {
    prompt: "In F2, count the reps whose sales reached their own target.",
    rows: fill(
      [
        ["Rep", "Target", "Sales", null, null, null],
        ["Nia", 52000, 50850, null, null, null],
        ["Owen", 48000, 49200, null, null, null],
        ["Pia", 55000, 55000, null, null, null],
        ["Quin", 40000, 38750, null, null, null],
        ["Rosa", 60000, 64100, null, null, null],
        ["Sam", 45000, 44990, null, null, null],
        ["Tess", 50000, 51800, null, null, null],
        ["Uri", 42000, 39900, null, null, null],
      ],
      4,
      { 0: [null, "Hit target"] },
    ),
    cell: "F2",
    answer: "=SUMPRODUCT(--(C2:C9>=B2:B9))",
    required: [],
    accept: ["=SUM(--(C2:C9>=B2:B9))", "=SUMPRODUCT((C2:C9-B2:B9>=0)*1)"],
    variants: [{ C2: 52000 }, { C6: 59000 }],
    reject: [
      ["=SUMPRODUCT(--(C2:C9>B2:B9))", "value"],
      ['=COUNTIF(C2:C9,">="&B2)', "value"],
    ],
    nudge: "Compare each rep's sales with their own target, row by row.",
    rule: "C2:C9>=B2:B9 tests each row; SUMPRODUCT counts the TRUE results.",
    value: (e) => `${e} reps reached their target.`,
  }),

  // revenue-for-a-region-and-month (level 2, step 3)
  step("revenue-for-a-region-and-month", 1, 1, "Revenue for the North", {
    prompt: "In G2, add up the revenue for the North region. Use SUMIF.",
    rows: fill(regions, 5, { 0: [null, "North revenue"] }),
    cell: "G2",
    answer: '=SUMIF(A2:A11,"North",C2:C11)',
    required: ["SUMIF"],
    accept: ['=SUMIF($A$2:$A$11,"North",$C$2:$C$11)'],
    variants: [{ C2: 12000 }],
    reject: [['=SUMIF(A2:A11,"North",B2:B11)', "value"]],
    nudge: "Test the Region column, add the Revenue column.",
    rule: 'SUMIF(A2:A11,"North",C2:C11) adds the North rows.',
    value: (e) => `The North made ${e}.`,
  }),
  step("revenue-for-a-region-and-month", 2, 1, "Revenue for the region in a cell", {
    prompt: "In G2, add up the revenue for the region typed in F2. Use SUMIF.",
    rows: fill(regions, 5, { 0: ["Region", "Revenue"], 1: ["West", null] }),
    cell: "G2",
    answer: "=SUMIF(A2:A11,F2,C2:C11)",
    required: ["SUMIF"],
    accept: ["=SUMIF($A$2:$A$11,$F$2,$C$2:$C$11)"],
    variants: [{ F2: "South" }],
    reject: [["=SUMIF(B2:B11,F2,C2:C11)", "value"]],
    nudge: "Point the condition at F2 instead of typing the region.",
    rule: "SUMIF(A2:A11,F2,C2:C11) follows whatever region F2 holds.",
    value: (e) => `The West made ${e}.`,
  }),
  step("revenue-for-a-region-and-month", 4, 2, "Revenue for a region outside one month", {
    prompt:
      "In H2, add up the revenue for the region in F2 in every month except the one in G2. Use SUMIFS.",
    rows: fill(regions, 5, { 0: ["Region", "Not month", "Revenue"], 1: ["South", "Feb", null] }),
    cell: "H2",
    answer: '=SUMIFS(C2:C11,A2:A11,F2,B2:B11,"<>"&G2)',
    required: ["SUMIFS"],
    accept: ["=SUMIF(A2:A11,F2,C2:C11)-SUMIFS(C2:C11,A2:A11,F2,B2:B11,G2)"],
    variants: [{ G2: "Jan" }, { F2: "North" }],
    reject: [["=SUMIFS(C2:C11,A2:A11,F2,B2:B11,G2)", "value"]],
    nudge: 'Join "<>" to the month cell to say "not this month".',
    rule: 'B2:B11,"<>"&G2 keeps every month except the one in G2.',
    value: (e) => `The South made ${e} outside February.`,
  }),
  step("revenue-for-a-region-and-month", 5, 3, "Best region in a month", {
    prompt: "In F2, name the region in E2:E4 with the most revenue in the month typed in F1.",
    rows: fill(regions, 4, {
      0: ["Region", "Feb"],
      1: ["North", null],
      2: ["South", null],
      3: ["West", null],
    }),
    cell: "F2",
    answer:
      "=INDEX(E2:E4,MATCH(MAX(SUMIFS(C2:C11,A2:A11,E2:E4,B2:B11,F1)),SUMIFS(C2:C11,A2:A11,E2:E4,B2:B11,F1),0))",
    required: [],
    accept: [
      "=XLOOKUP(MAX(SUMIFS(C2:C11,A2:A11,E2:E4,B2:B11,F1)),SUMIFS(C2:C11,A2:A11,E2:E4,B2:B11,F1),E2:E4)",
    ],
    variants: [{ F1: "Jan" }, { C6: 20000 }],
    reject: [
      [
        "=INDEX(E2:E4,MATCH(MAX(SUMIF(A2:A11,E2:E4,C2:C11)),SUMIF(A2:A11,E2:E4,C2:C11),0))",
        "value",
      ],
      ['="South"', "reference"],
    ],
    nudge: "Work out every region's total for that month at once, then pick the highest.",
    rule: "SUMIFS with E2:E4 as a criteria gives one total per region for the month.",
    value: (e) => `${e} made the most that month.`,
  }),

  // best-return-on-ad-spend (level 3, step 4)
  step("best-return-on-ad-spend", 1, 1, "Return for one campaign", {
    prompt:
      "In E2, work out the revenue earned for each unit spent on Search: the revenue in C2 divided by the spend in B2.",
    rows: fill(ads, 3, { 0: [null, "Search return"] }),
    cell: "E2",
    answer: "=C2/B2",
    required: [],
    accept: ["=C2*(1/B2)"],
    variants: [{ C2: 21000 }],
    reject: [["=B2/C2", "value"]],
    nudge: "Revenue over spend.",
    rule: "C2/B2 is the revenue for each unit of spend.",
    value: (e) => `Search returned ${e} per unit spent.`,
  }),
  step("best-return-on-ad-spend", 2, 2, "Return for the campaign in a cell", {
    prompt:
      "In F2, show the return on spend of the campaign typed in E2, rounded to 2 decimals. Use XLOOKUP and ROUND.",
    rows: fill(ads, 3, { 0: [null, "Campaign", "Return"], 1: [null, "Radio", null] }),
    cell: "F2",
    answer: "=ROUND(XLOOKUP(E2,A2:A8,C2:C8)/XLOOKUP(E2,A2:A8,B2:B8),2)",
    required: ["XLOOKUP", "ROUND"],
    accept: ["=ROUND(XLOOKUP(E2,A2:A8,C2:C8/B2:B8),2)"],
    variants: [{ E2: "Social" }],
    reject: [["=ROUND(XLOOKUP(E2,A2:A8,B2:B8)/XLOOKUP(E2,A2:A8,C2:C8),2)", "value"]],
    nudge: "Look up the revenue and the spend, then divide.",
    rule: "Two lookups give the campaign's revenue and spend for the division.",
    value: (e) => `Radio returned ${e} per unit spent.`,
  }),
  step("best-return-on-ad-spend", 3, 2, "Best return of all", {
    prompt:
      "In E2, show the highest return on spend of any campaign, rounded to 2 decimals. Use MAX and ROUND.",
    rows: fill(ads, 3, { 0: [null, "Best return"] }),
    cell: "E2",
    answer: "=ROUND(MAX(C2:C8/B2:B8),2)",
    required: ["MAX", "ROUND"],
    accept: ["=MAX(ROUND(C2:C8/B2:B8,2))"],
    variants: [{ C4: 4500 }],
    reject: [["=ROUND(MAX(C2:C8)/MAX(B2:B8),2)", "value"]],
    nudge: "Divide each campaign's revenue by its own spend, then take the largest.",
    rule: "C2:C8/B2:B8 gives every campaign's return; MAX picks the best.",
    value: (e) => `The best return is ${e}.`,
  }),
  step("best-return-on-ad-spend", 5, 3, "Best return among big campaigns", {
    prompt:
      "In F2, name the campaign with the best return on spend among those that spent at least the amount in F1.",
    rows: fill(ads, 3, { 0: [null, "Minimum spend", 2000], 1: [null, "Best campaign", null] }),
    cell: "F2",
    answer: "=INDEX(A2:A8,MATCH(MAX((B2:B8>=F1)*C2:C8/B2:B8),(B2:B8>=F1)*C2:C8/B2:B8,0))",
    required: [],
    accept: ["=XLOOKUP(MAX(FILTER(C2:C8/B2:B8,B2:B8>=F1)),C2:C8/B2:B8,A2:A8)"],
    variants: [{ F1: 5000 }, { C8: 9000 }],
    reject: [
      ["=INDEX(A2:A8,MATCH(MAX(C2:C8/B2:B8),C2:C8/B2:B8,0))", "value"],
      ['="Search"', "reference"],
    ],
    nudge: "Leave out the small campaigns first, then find the best return.",
    rule: "Multiplying by (B2:B8>=F1) zeroes the small campaigns before MAX looks.",
    value: (e) => `${e} has the best return among the big campaigns.`,
  }),

  // top-three-customers-share (level 3, step 4)
  step("top-three-customers-share", 1, 1, "One customer's share", {
    prompt:
      "In E2, show Calder's share of all revenue as a percentage rounded to one decimal place. Use SUM and ROUND.",
    rows: fill(customers, 2, { 0: [null, null, "Calder %"] }),
    cell: "E2",
    answer: "=ROUND(B4/SUM(B2:B11)*100,1)",
    required: ["SUM", "ROUND"],
    accept: ["=ROUND(100*B4/SUM(B2:B11),1)"],
    variants: [{ B4: 70000 }],
    reject: [["=ROUND(B4/SUM(B2:B11),1)", "value"]],
    nudge: "Calder's revenue over the total, times 100.",
    rule: "B4/SUM(B2:B11) is Calder's slice of the total.",
    value: (e) => `Calder brings ${e}% of revenue.`,
  }),
  step("top-three-customers-share", 2, 2, "Biggest customer's share", {
    prompt:
      "In E2, show the share of revenue from the single biggest customer, as a percentage rounded to one decimal place. Use MAX, SUM and ROUND.",
    rows: fill(customers, 2, { 0: [null, null, "Biggest %"] }),
    cell: "E2",
    answer: "=ROUND(MAX(B2:B11)/SUM(B2:B11)*100,1)",
    required: ["MAX", "SUM", "ROUND"],
    accept: ["=ROUND(100*MAX(B2:B11)/SUM(B2:B11),1)"],
    variants: [{ B7: 80000 }],
    reject: [["=ROUND(MAX(B2:B11)/SUM(B2:B11),1)", "value"]],
    nudge: "MAX finds the biggest customer wherever it sits.",
    rule: "MAX(B2:B11)/SUM(B2:B11) is the top customer's slice.",
    value: (e) => `The biggest customer brings ${e}% of revenue.`,
  }),
  step("top-three-customers-share", 3, 2, "Revenue of the top three", {
    prompt: "In E2, add up the revenue of the three biggest customers. Use LARGE.",
    rows: fill(customers, 2, { 0: [null, null, "Top three"] }),
    cell: "E2",
    answer: "=LARGE(B2:B11,1)+LARGE(B2:B11,2)+LARGE(B2:B11,3)",
    required: ["LARGE"],
    accept: ["=SUM(LARGE(B2:B11,{1,2,3}))"],
    variants: [{ B9: 60000 }],
    reject: [["=LARGE(B2:B11,3)", "value"]],
    nudge: "LARGE(range,2) is the second biggest; add the first three.",
    rule: "LARGE with 1, 2 and 3 returns the three biggest revenues.",
    value: (e) => `The top three customers bring ${e}.`,
  }),
  step("top-three-customers-share", 5, 3, "Share of the top N customers", {
    prompt:
      "In E2, show what share of revenue comes from the biggest customers, as many as the number in E1. Show it as a percentage rounded to one decimal place.",
    rows: fill(customers, 2, { 0: [null, "Top N", 4], 1: [null, "Share %", null] }),
    cell: "E2",
    answer: "=ROUND(SUM(TAKE(SORT(B2:B11,1,-1),E1))/SUM(B2:B11)*100,1)",
    required: [],
    accept: ["=ROUND(SUM(LARGE(B2:B11,SEQUENCE(E1)))/SUM(B2:B11)*100,1)"],
    variants: [{ E1: 2 }, { B10: 50000 }],
    reject: [
      ["=ROUND(SUM(TAKE(SORT(B2:B11,1,-1),3))/SUM(B2:B11)*100,1)", "value"],
      ["=ROUND(SUM(TAKE(B2:B11,E1))/SUM(B2:B11)*100,1)", "value"],
    ],
    nudge: "Sort the revenue from biggest down, then take as many as E1 says.",
    rule: "TAKE(SORT(...,-1),E1) keeps the E1 biggest revenues.",
    value: (e) => `The top customers bring ${e}% of revenue.`,
  }),
];
