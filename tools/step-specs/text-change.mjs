// Ladder steps for the "text-change" track (docs/content.md, Ladder steps). The
// YAML files are the source of truth once written: variants added later by
// tools/suggest-variants.ts and by hand live only there, so do not --write this again.
// Each exercise's own slot: level 2 at step 3.
const step = (parent, n, level, title, screen) => ({
  parent,
  step: n,
  level,
  title,
  screens: [screen],
});

const staff = [
  ["Name", "Team", null, null],
  ["Ada", "Sales", null, null],
  ["Ben", "Finance", null, null],
  ["Cleo", "Sales", null, null],
  ["Dev", "IT", null, null],
  ["Eve", "Sales", null, null],
  ["Finn", "Finance", null, null],
  ["Gus", "IT", null, null],
  ["Hana", "Sales", null, null],
  ["Ivo", "Ops", null, null],
  ["Jana", "Finance", null, null],
  ["Kai", "Sales", null, null],
  ["Lee", "IT", null, null],
  ["Mo", "Ops", null, null],
  ["Nia", "Sales", null, null],
  ["Ola", "Finance", null, null],
];

export default [
  // concat-and-the-operator (level 2, step 3)
  step("concat-and-the-operator", 1, 1, "Join two names with &", {
    prompt:
      "In C2, join the first name in A2 and the last name in B2 with a space between, using the & operator.",
    rows: [
      ["First", "Last", "Full name"],
      ["Grace", "Hopper", null],
    ],
    cell: "C2",
    answer: '=A2&" "&B2',
    required: [],
    accept: ['=CONCAT(A2," ",B2)', '=TEXTJOIN(" ",TRUE,A2:B2)'],
    variants: [{ A2: "Alan", B2: "Turing" }],
    reject: [
      ["=A2&B2", "value"],
      ['="Grace Hopper"', "reference"],
    ],
    nudge: '& joins text; the space goes in quotes: " ".',
    rule: 'A2&" "&B2 joins the first name, a space and the last name.',
    value: (e) => `The full name is ${e}.`,
  }),
  step("concat-and-the-operator", 2, 1, "City and country", {
    prompt:
      "In C2, join the city in A2 and the country in B2 with a comma and a space between. Use CONCAT.",
    rows: [
      ["City", "Country", "Place"],
      ["Lyon", "France", null],
    ],
    cell: "C2",
    answer: '=CONCAT(A2,", ",B2)',
    required: ["CONCAT"],
    accept: ['=CONCAT(A2,", ",B2)'],
    variants: [{ A2: "Porto", B2: "Portugal" }],
    reject: [
      ['=A2&", "&B2', "required-function"],
      ['=CONCAT(A2,",",B2)', "value"],
    ],
    nudge: "CONCAT takes each piece in order, separated by commas.",
    rule: 'CONCAT(A2,", ",B2) puts a comma and a space between the two cells.',
    value: (e) => `The place reads ${e}.`,
  }),
  step("concat-and-the-operator", 4, 2, "Sentence with a number formatted", {
    prompt:
      "In C2, build the line Order 1042 total: 87.50, using the order in A2 and the total in B2 shown with 2 decimals. Use TEXT for the number.",
    rows: [
      ["Order", "Total", "Line"],
      [1042, 87.5, null],
    ],
    cell: "C2",
    answer: '="Order "&A2&" total: "&TEXT(B2,"0.00")',
    required: ["TEXT"],
    accept: ['=CONCAT("Order ",A2," total: ",TEXT(B2,"0.00"))'],
    variants: [{ A2: 1043, B2: 120 }],
    reject: [
      ['="Order "&A2&" total: "&B2', "required-function"],
      ['="Order "&A2&" total: "&TEXT(B2,"0")', "value"],
    ],
    nudge: 'Joining a number drops its trailing zeros; TEXT(B2,"0.00") keeps two decimals.',
    rule: 'TEXT(B2,"0.00") turns 87.5 into the text 87.50 before it is joined.',
    value: (e) => `The line should read ${e}.`,
  }),
  step("concat-and-the-operator", 5, 3, "Build a work email address", {
    prompt:
      "In C2, what is this person's work email? It is the first letter of the first name, then the last name, all in lower case, then @acme.com.",
    rows: [
      ["First", "Last", "Email"],
      ["Grace", "Hopper", null],
    ],
    cell: "C2",
    answer: '=LOWER(LEFT(A2,1)&B2)&"@acme.com"',
    required: [],
    accept: [
      '=LOWER(LEFT(A2,1)&B2&"@acme.com")',
      '=CONCAT(LOWER(LEFT(A2,1)),LOWER(B2),"@acme.com")',
    ],
    variants: [
      { A2: "Alan", B2: "Turing" },
      { A2: "katherine", B2: "JOHNSON" },
    ],
    reject: [
      ['=LEFT(A2,1)&B2&"@acme.com"', "value"],
      ['=LOWER(A2&B2)&"@acme.com"', "value"],
    ],
    nudge:
      "Take one letter of the first name, add the last name, lower-case it, then add the domain.",
    rule: 'LEFT(A2,1)&B2 gives GHopper; LOWER turns it into ghopper; &"@acme.com" adds the domain.',
    value: (e) => `The email is ${e}.`,
  }),

  // textjoin-join-a-range-and-skip-blanks (level 2, step 3)
  step("textjoin-join-a-range-and-skip-blanks", 1, 1, "Join a list with commas", {
    prompt:
      "In B7, join the four cities in A2:A5 into one line, separated by a comma and a space. Use TEXTJOIN.",
    rows: [
      ["City", null],
      ["Leeds", null],
      ["York", null],
      ["Hull", null],
      ["Bath", null],
      [null, null],
      ["Cities", null],
    ],
    cell: "B7",
    answer: '=TEXTJOIN(", ",TRUE,A2:A5)',
    required: ["TEXTJOIN"],
    accept: ['=TEXTJOIN(", ",FALSE,A2:A5)'],
    variants: [{ A3: "Durham" }],
    reject: [
      ['=TEXTJOIN(",",TRUE,A2:A5)', "value"],
      ['=A2&", "&A3&", "&A4&", "&A5', "required-function"],
    ],
    nudge: "TEXTJOIN takes the separator, whether to skip blanks, then the range.",
    rule: 'TEXTJOIN(", ",TRUE,A2:A5) joins the range with a comma and a space between items.',
    value: (e) => `The line reads ${e}.`,
  }),
  step("textjoin-join-a-range-and-skip-blanks", 2, 1, "Join a row with slashes", {
    prompt:
      'In G2, join the shifts in B2:F2 with " / " between them, skipping the empty days. Use TEXTJOIN.',
    rows: [
      ["Name", "Mon", "Tue", "Wed", "Thu", "Fri", "Shifts"],
      ["Ada", "Early", null, "Late", "Early", null, null],
    ],
    cell: "G2",
    answer: '=TEXTJOIN(" / ",TRUE,B2:F2)',
    required: ["TEXTJOIN"],
    accept: ['=TEXTJOIN(" / ",1,B2:F2)'],
    variants: [{ C2: "Night" }],
    reject: [['=TEXTJOIN(" / ",FALSE,B2:F2)', "value"]],
    nudge: "TRUE as the second part skips the empty days.",
    rule: 'TEXTJOIN(" / ",TRUE,B2:F2) lists only the days that have a shift.',
    value: (e) => `Ada's shifts read ${e}.`,
  }),
  step("textjoin-join-a-range-and-skip-blanks", 4, 2, "Keep blanks as empty slots", {
    prompt:
      "In F2, join A2:E2 into a CSV line with plain commas, keeping each empty cell as an empty slot so the columns stay in place. Use TEXTJOIN.",
    rows: [
      ["Code", "Name", "Phone", "City", "Notes", "CSV"],
      ["C-7", "Lee", null, "York", null, null],
    ],
    cell: "F2",
    answer: '=TEXTJOIN(",",FALSE,A2:E2)',
    required: ["TEXTJOIN"],
    accept: ['=TEXTJOIN(",",0,A2:E2)'],
    variants: [{ C2: "0711 223" }],
    reject: [['=TEXTJOIN(",",TRUE,A2:E2)', "value"]],
    nudge: "FALSE keeps the empty cells, so two commas mark a blank.",
    rule: 'TEXTJOIN(",",FALSE,A2:E2) keeps every slot, which a CSV file needs.',
    value: (e) => `The CSV line is ${e}.`,
  }),
  step("textjoin-join-a-range-and-skip-blanks", 5, 3, "Everyone in one team, on one line", {
    prompt:
      "In D2, list the names of everyone in the team typed in D1, separated by a comma and a space.",
    rows: staff.map((r, i) =>
      i === 0 ? ["Name", "Team", null, "Sales"] : i === 1 ? ["Ada", "Sales", null, null] : r,
    ),
    cell: "D2",
    answer: '=TEXTJOIN(", ",TRUE,IF(B2:B16=D1,A2:A16,""))',
    required: [],
    accept: ['=TEXTJOIN(", ",TRUE,FILTER(A2:A16,B2:B16=D1))'],
    variants: [{ D1: "IT" }, { B3: "Sales" }],
    reject: [
      ['=TEXTJOIN(", ",TRUE,A2:A16)', "value"],
      ['=TEXTJOIN(", ",TRUE,IF(B2:B16="Sales",A2:A16,""))', "fragile"],
    ],
    nudge: "Keep only the names whose team matches D1, then join them.",
    rule: 'IF(B2:B16=D1,A2:A16,"") gives the name or nothing on each row; TEXTJOIN skips the empty ones.',
    value: (e) => `The Sales team is ${e}.`,
  }),

  // upper-lower-and-proper (level 2, step 3)
  step("upper-lower-and-proper", 1, 1, "Email in lower case", {
    prompt: "In B2, put the email address in A2 into lower case. Use LOWER.",
    rows: [
      ["Email", "Tidy"],
      ["Ada.Lovelace@Engines.CO.UK", null],
    ],
    cell: "B2",
    answer: "=LOWER(A2)",
    required: ["LOWER"],
    accept: ["=lower(a2)"],
    variants: [{ A2: "GRACE@Navy.mil" }],
    reject: [["=PROPER(A2)", "required-function"]],
    nudge: "LOWER changes every letter to lower case.",
    rule: "LOWER(A2) leaves numbers and symbols as they are.",
    value: (e) => `The tidy email is ${e}.`,
  }),
  step("upper-lower-and-proper", 2, 1, "Postcode in capitals", {
    prompt: "In B2, put the postcode in A2 into capitals. Use UPPER.",
    rows: [
      ["Postcode", "Tidy"],
      ["yo1 7hu", null],
    ],
    cell: "B2",
    answer: "=UPPER(A2)",
    required: ["UPPER"],
    accept: ["=upper(a2)"],
    variants: [{ A2: "ne1 4xf" }],
    reject: [["=PROPER(A2)", "required-function"]],
    nudge: "UPPER changes every letter to a capital.",
    rule: "UPPER(A2) gives YO1 7HU.",
    value: (e) => `The postcode reads ${e}.`,
  }),
  step("upper-lower-and-proper", 4, 2, "Tidy a messy name", {
    prompt:
      "In B2, tidy the name in A2: remove the extra spaces, then give each word a capital first letter. Use TRIM and PROPER.",
    rows: [
      ["Name", "Tidy"],
      ["  mary   JACKSON ", null],
    ],
    cell: "B2",
    answer: "=PROPER(TRIM(A2))",
    required: ["PROPER", "TRIM"],
    accept: ["=TRIM(PROPER(A2))"],
    variants: [{ A2: "alan    turing" }],
    reject: [
      ["=PROPER(A2)", "required-function"],
      ["=TRIM(A2)", "required-function"],
    ],
    nudge:
      "TRIM removes the spaces at the ends and doubles in the middle; PROPER fixes the capitals.",
    rule: "PROPER(TRIM(A2)) gives Mary Jackson.",
    value: (e) => `The tidy name is ${e}.`,
  }),
  step("upper-lower-and-proper", 5, 3, "Count exact matches, capitals included", {
    prompt: "In D2, how many codes in A2:A16 match the code in D1 exactly, capitals included?",
    rows: [
      ["Code", null, null, "Ab-12x"],
      ["Ab-12x", null, null, null],
      ["AB-12X", null, null, null],
      ["ab-12x", null, null, null],
      ["Ab-12x", null, null, null],
      ["Ab-13x", null, null, null],
      ["Ab-12X", null, null, null],
      ["Ab-12x", null, null, null],
      ["CD-44", null, null, null],
      ["ab-12X", null, null, null],
      ["Ab-12x", null, null, null],
      ["Ab-12x ", null, null, null],
      ["EF-90", null, null, null],
      ["Ab-12x", null, null, null],
      ["AB-12x", null, null, null],
      ["Ab-12x", null, null, null],
    ],
    cell: "D2",
    answer: "=SUMPRODUCT(--EXACT(A2:A16,D1))",
    required: [],
    accept: ["=SUM(--EXACT(A2:A16,D1))"],
    variants: [{ D1: "AB-12X" }, { A3: "Ab-12x" }],
    reject: [
      ["=COUNTIF(A2:A16,D1)", "value"],
      ["=SUMPRODUCT(--(A2:A16=D1))", "value"],
    ],
    nudge: "COUNTIF and = ignore capitals; EXACT does not.",
    rule: "EXACT(A2:A16,D1) is TRUE only for an identical code, capitals and spaces included; SUMPRODUCT counts them.",
    value: (e) => `${e} codes match exactly.`,
  }),

  // substitute-replace-one-piece-of-text (level 2, step 3)
  step("substitute-replace-one-piece-of-text", 1, 1, "Remove the spaces", {
    prompt:
      'In B2, remove every space from the account number in A2. Use SUBSTITUTE with "" as the new text.',
    rows: [
      ["Account", "No spaces"],
      ["GB29 NWBK 6016 1331", null],
    ],
    cell: "B2",
    answer: '=SUBSTITUTE(A2," ","")',
    required: ["SUBSTITUTE"],
    accept: ['=SUBSTITUTE($A$2," ","")'],
    variants: [{ A2: "DE89 3704 0044" }],
    reject: [["=TRIM(A2)", "required-function"]],
    nudge: "Replacing a space with nothing removes it.",
    rule: 'SUBSTITUTE(A2," ","") removes every space.',
    value: (e) => `Without spaces: ${e}.`,
  }),
  step("substitute-replace-one-piece-of-text", 2, 1, "Replace a word", {
    prompt: "In B2, replace Ltd with Limited in the company name in A2. Use SUBSTITUTE.",
    rows: [
      ["Company", "Full name"],
      ["Acme Tools Ltd", null],
    ],
    cell: "B2",
    answer: '=SUBSTITUTE(A2,"Ltd","Limited")',
    required: ["SUBSTITUTE"],
    accept: ['=SUBSTITUTE(A2,"Ltd","Limited",1)'],
    variants: [{ A2: "Northwind Ltd" }],
    reject: [['=SUBSTITUTE(A2,"ltd","Limited")', "value"]],
    nudge: "SUBSTITUTE matches capitals exactly.",
    rule: 'SUBSTITUTE(A2,"Ltd","Limited") swaps the word wherever it appears.',
    value: (e) => `The full name is ${e}.`,
  }),
  step("substitute-replace-one-piece-of-text", 4, 2, "Remove two kinds of character", {
    prompt:
      "In B2, remove both brackets from the phone number in A2. Use SUBSTITUTE inside SUBSTITUTE.",
    rows: [
      ["Phone", "No brackets"],
      ["(020) 7946 0018", null],
    ],
    cell: "B2",
    answer: '=SUBSTITUTE(SUBSTITUTE(A2,"(",""),")","")',
    required: ["SUBSTITUTE"],
    accept: ['=SUBSTITUTE(SUBSTITUTE(A2,")",""),"(","")'],
    variants: [{ A2: "(0113) 496 0221" }],
    reject: [['=SUBSTITUTE(A2,"(","")', "value"]],
    nudge: "The inner SUBSTITUTE removes one bracket; the outer one removes the other.",
    rule: "Nesting applies the second replacement to the result of the first.",
    value: (e) => `Without brackets: ${e}.`,
  }),
  step("substitute-replace-one-piece-of-text", 5, 3, "Items in a comma-separated list", {
    prompt:
      "In B2, how many items are in the comma-separated list in A2? An empty list has 0 items.",
    rows: [
      ["List", "Items"],
      ["pens,pads,clips,tape", null],
    ],
    cell: "B2",
    answer: '=IF(TRIM(A2)="",0,LEN(A2)-LEN(SUBSTITUTE(A2,",",""))+1)',
    required: [],
    accept: ['=IF(A2="",0,LEN(A2)-LEN(SUBSTITUTE(A2,",",""))+1)'],
    variants: [{ A2: "ink" }, { A2: "" }, { A2: "a,b,c,d,e,f" }],
    reject: [
      ['=LEN(A2)-LEN(SUBSTITUTE(A2,",",""))+1', "fragile"],
      ['=LEN(A2)-LEN(SUBSTITUTE(A2,",",""))', "value"],
    ],
    nudge: "Each comma separates two items, so items are commas plus 1, except for an empty list.",
    rule: "LEN minus LEN without commas counts the commas; +1 gives the items; the IF gives 0 for an empty cell.",
    value: (e) => `The list has ${e} items.`,
  }),
];
