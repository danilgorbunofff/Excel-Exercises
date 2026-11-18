// Sample data copied from the live pages, shared by every mock. One coherent
// visitor state: signed out, solved Monday's daily and one exercise with help.

// Line icons: same paths as src/components/Icon.astro.
const PATHS = {
  sigma: "M17 5H7l6 7-6 7h10",
  count: "M5 5h4v4H5zM15 5h4v4h-4zM5 15h4v4H5zM15 15h4v4h-4z",
  branch: "M6 4v8a4 4 0 0 0 4 4h8M6 4a2 2 0 1 0 0 .1M18 16l-3-3M18 16l-3 3",
  filter: "M4 5h16l-6 8v6l-4-2v-4z",
  lookup: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM15 15l5 5",
  formula: "M8 20c2 0 2-2 3-8s1-8 3-8M7 10h7M14 13l5 6M19 13l-5 6",
  chart: "M5 19V9M10 19V5M15 19v-7M20 19H4",
  text: "M5 5h14M12 5v14M9 19h6",
  hint: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h2M14 14h2",
  grid: "M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16",
  cells: "M4 6h7v5H4zM13 6h7v5h-7zM4 13h7v5H4zM13 13h7v5h-7z",
  check: "M5 12l4 4 10-10",
  bolt: "M13 3L5 14h6l-1 7 8-11h-6z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  play: "M7 5l12 7-12 7z",
  reset: "M4 4v6h6M20 12a8 8 0 0 1-14.9 4M4.1 10A8 8 0 0 1 20 12",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  file: "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6",
};
window.icon = (name, size = 20) =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;
window.box = (name) => `<span class="icon-box">${icon(name, 22)}</span>`;

window.D = {
  groups: [
    ["sigma", "Totals and averages", "SUM AVERAGE MAX MIN SUMPRODUCT SUBTOTAL AGGREGATE"],
    ["count", "Count cells", "COUNT COUNTA COUNTBLANK COUNTIF COUNTIFS"],
    ["branch", "Choose between results", "IF AND OR IFS SWITCH"],
    ["filter", "Add up what matches", "SUMIF SUMIFS AVERAGEIF"],
    ["lookup", "Find a value in a table", "XLOOKUP VLOOKUP INDEX MATCH HLOOKUP"],
    ["formula", "Round and adjust numbers", "ROUND ROUNDUP ROUNDDOWN MROUND FLOOR ABS"],
    ["chart", "Pick and rank values", "LARGE SMALL MEDIAN MODE RANK"],
    ["text", "Work with text", "LEFT RIGHT MID LEN FIND SEARCH TEXTBEFORE TEXTAFTER CONCAT TEXTJOIN UPPER LOWER PROPER TRIM SUBSTITUTE"],
    ["hint", "Catch errors and test cells", "IFERROR IFNA ISERROR ISNA ISBLANK ISNUMBER"],
    ["calendar", "Work with dates", "DATE DAYS DATEDIF"],
    ["grid", "Return a whole list", "FILTER UNIQUE SORT SORTBY TAKE LET"],
  ].map(([icon, title, fns]) => ({ icon, title, fns: fns.split(" ") })),
  picked: ["SUM", "AVERAGE", "XLOOKUP"],
  sets: [
    { title: "Sample assessment", summary: "Three short tasks to see how a timed assessment works.", tasks: 3, min: 10, fns: ["SUM", "COUNT", "IF"], level: 1, free: true },
    { title: "Beginner", summary: "Totals, averages, counts, a first IF and simple percentages, for a first Excel test.", tasks: 10, min: 25, fns: ["SUM", "AVERAGE", "MAX", "MIN", "COUNTA", "IF", "COUNT", "ROUND"], level: 1 },
    { title: "Intermediate", summary: "Conditional counts and totals, lookups with a fallback, bands and text, as in a general Excel test.", tasks: 10, min: 35, fns: ["COUNTIF", "SUMIF", "COUNTIFS", "XLOOKUP", "IFERROR", "LEFT", "IFS", "TEXTJOIN", "SUMIFS", "IF", "ROUND", "AVERAGEIF"], level: 2 },
    { title: "Office essentials", summary: "The everyday formulas an office job expects, from totals to a first lookup.", tasks: 10, min: 30, fns: ["SUMPRODUCT", "AVERAGE", "COUNTIF", "SUMIF", "SUM", "VLOOKUP", "IF", "ROUND"], level: 2 },
    { title: "Data analyst", summary: "Conditional counts, lookups, ranking, text and dynamic arrays, as in an analyst screening test.", tasks: 10, min: 40, fns: ["COUNTIFS", "AVERAGEIF", "INDEX", "MATCH", "MAX", "FILTER", "UNIQUE", "SORT", "RANK", "LARGE", "XLOOKUP", "TEXTJOIN", "LEFT", "FIND", "IFERROR", "SUMIFS", "LET"], level: 3 },
    { title: "Finance", summary: "Margins, run rates, variances, tax bands and weighted costs, as in a finance or accounting test.", tasks: 10, min: 40, fns: ["ROUND", "SUMIF", "AVERAGE", "IF", "ABS", "SUMPRODUCT", "XLOOKUP", "IFS", "ROUNDUP"], level: 3 },
  ],
  levels: ["", "Beginner", "Intermediate", "Advanced"],
  // Monday solved, Tuesday not solved, today open: streak 0, best 1.
  week: [
    ["Mon", 16, "Warm-up", "done"],
    ["Tue", 17, "Easy", "miss"],
    ["Wed", 18, "Steady", "now"],
    ["Thu", 19, "Medium", ""],
    ["Fri", 20, "Tricky", ""],
    ["Sat", 21, "Hard", ""],
    ["Sun", 22, "Hardest", ""],
  ],
  dayWords: { done: "Solved", miss: "Not solved", now: "Today", "": "Upcoming" },
  tracks: [
    ["cells", "Cells and arithmetic", 4, 0, 1],
    ["sigma", "SUM, AVERAGE, MIN and MAX", 7, 1, 1],
    ["count", "COUNT, COUNTA and COUNTBLANK", 5, 0, 1],
    ["branch", "IF, AND and OR", 10, 0, 2],
    ["formula", "ROUND, ROUNDUP and MROUND", 3, 0, 2],
    ["lookup", "XLOOKUP, VLOOKUP, INDEX and MATCH", 11, 0, 2],
  ].map(([icon, title, n, done, level]) => ({ icon, title, n, done, level })),
  exercises: [
    ["", "Add two cells", "Cell references · Cells and arithmetic", 1, false],
    ["", "Subtract the costs", "Cell references · Cells and arithmetic", 1, false],
    ["", "Multiply price by quantity", "Cell references · Cells and arithmetic", 1, true],
    ["", "Price after a discount", "Cell references · Cells and arithmetic", 2, true],
    ["helped", "Add up a column", "SUM · SUM, AVERAGE, MIN and MAX", 1, false],
    ["", "Average score", "AVERAGE · SUM, AVERAGE, MIN and MAX", 1, false],
    ["", "Find the largest sale", "MAX · SUM, AVERAGE, MIN and MAX", 1, true],
  ],
};

window.chips = (fns, shown = 5) =>
  fns.slice(0, shown).map((f) => `<span class="chip">${f}</span>`).join("") +
  (fns.length > shown ? `<span class="more">+${fns.length - shown} more</span>` : "");

window.fnButtons = (fns) =>
  fns
    .map((f) => {
      const on = D.picked.includes(f);
      return `<button class="fn" aria-pressed="${on}">${on ? icon("check", 14) : ""}${f}</button>`;
    })
    .join("");

window.fill = (id, html) => {
  document.getElementById(id).innerHTML = html;
};

// Week as a compact 7-cell strip; fits a phone.
window.weekStrip = () =>
  `<ol class="week-strip">${D.week
    .map(
      ([d, n, label, s]) =>
        `<li class="${s}" title="${label}: ${D.dayWords[s]}"><span>${d}</span><b>${n}</b><i>${
          s === "done" ? icon("check", 14) : ""
        }</i><span class="visually-hidden">${label}, ${D.dayWords[s]}</span></li>`,
    )
    .join("")}</ol>`;

window.SHEET = `
<div class="fx-bar"><span>F2</span><span>=</span></div>
<div class="sheet-wrap"><table class="sheet">
  <tr><th></th><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th><th>F</th></tr>
  <tr><th>1</th><td>Player</td><td>Team</td><td>Score</td><td></td><td></td><td></td></tr>
  <tr><th>2</th><td>Ann</td><td>Blue</td><td class="n">72</td><td></td><td>Blue</td><td class="target"></td></tr>
  <tr><th>3</th><td>Bob</td><td>Red</td><td class="n">65</td><td></td><td></td><td></td></tr>
  <tr><th>4</th><td>Cat</td><td>Blue</td><td class="n">88</td><td></td><td></td><td></td></tr>
  <tr><th>5</th><td>Dev</td><td>Red</td><td class="n">70</td><td></td><td></td><td></td></tr>
  <tr><th>6</th><td>Eli</td><td>Blue</td><td class="n">79</td><td></td><td></td><td></td></tr>
  <tr><th>7</th><td>Fay</td><td>Red</td><td class="n">91</td><td></td><td></td><td></td></tr>
  <tr><th>8</th><td>Gus</td><td>Blue</td><td class="n">81</td><td></td><td></td><td></td></tr>
</table></div>
<div class="check-row"><span>Type a formula for <b>F2</b>, then press Enter or Check.</span>
  <span class="button button-primary">Check</span></div>
<div class="hints">
  <details><summary>${icon("hint", 18)}Hint 1</summary><p>You need the average of only some rows. Which function averages with a condition?</p></details>
  <details><summary>${icon("hint", 18)}Hint 2</summary><p>AVERAGEIF takes the range to test, the value to match, and the range to average.</p></details>
  <details><summary>${icon("eye", 18)}Show the answer</summary><p><code>=AVERAGEIF(B2:B8, E2, C2:C8)</code></p></details>
</div>`;
