// Why this exists: writes the Phase 2 mocks. Every direction gets the same
// HTML (landing, exercise wrong, exercise correct) and its own tokens and CSS,
// so the comparison is about design, not about different content.
// Run: node docs/directions/build.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { DIRECTIONS, type Direction, type Theme } from "./tokens.ts";

type State = "initial" | "wrong" | "correct";

const ROWS: [string, number | string][] = [
  ["Month", "Sales"],
  ["Jan", 120],
  ["Feb", 95],
  ["Mar", 143],
  ["Apr", 88],
  ["Total", ""],
];
const READ: Record<State, [number, number] | null> = {
  initial: null,
  wrong: [2, 4],
  correct: [2, 5],
};
const ANSWER: Record<State, string> = { initial: "", wrong: "358", correct: "446" };
const FORMULA: Record<State, string> = {
  initial: "",
  wrong: "=SUM(B2:B4)",
  correct: "=SUM(B2:B5)",
};

function grid(state: State): string {
  const read = READ[state];
  const rows = ROWS.map(([a, b], i) => {
    const r = i + 1;
    const isAnswer = r === 6;
    const inRead = read !== null && r >= read[0] && r <= read[1];
    const cls = [
      typeof b === "number" || isAnswer ? "num" : "",
      inRead ? "read" : "",
      inRead && r === read?.[0] ? "read-first" : "",
      inRead && r === read?.[1] ? "read-last" : "",
      isAnswer ? `answer answer-${state}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const value = isAnswer ? ANSWER[state] : String(b);
    return `        <tr><th scope="row">${r}</th><td${r === 1 ? ' class="label"' : ""}>${a}</td><td class="${cls}">${value}</td></tr>`;
  }).join("\n");
  return `      <table class="grid">
        <caption>Sales by month. Your answer goes in B6.</caption>
        <thead><tr><td class="corner"></td><th scope="col">A</th><th scope="col">B</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
      <ul class="legend">
        <li><span class="swatch swatch-read" aria-hidden="true"></span>Read by your formula</li>
        <li><span class="swatch swatch-answer" aria-hidden="true"></span>Your answer cell</li>
      </ul>`;
}

function verdict(state: State): string {
  if (state === "wrong") {
    return `<p class="status status-miss">Wrong total in B6</p>
          <p>B6 should show 446. Your formula gives 358.</p>
          <p class="readout">It reads <code>=SUM(<mark class="ref">B2:B4</mark>)</code>: 3 cells, total 358. They are outlined in the grid.</p>`;
  }
  if (state === "correct") {
    return `<p class="status status-correct">Correct</p>
          <p><code>=SUM(<mark class="ref">B2:B5</mark>)</code> adds 4 cells and gives 446.</p>`;
  }
  return "";
}

function exercise(state: State, headingLevel: 2 | null): string {
  const heading = headingLevel
    ? `<h2 id="ex-title">Try it: add up a column</h2>`
    : `<h2 id="ex-title" class="visually-hidden">The exercise</h2>`;
  const action =
    state === "correct"
      ? `<a class="primary" href="/exercises/find-the-average/">Next<span class="next-title">: Find the average</span></a>`
      : `<button class="primary" type="submit">Check</button>`;
  const value = FORMULA[state] ? ` value="${FORMULA[state]}"` : "";
  return `    <section class="exercise exercise-${state}" aria-labelledby="ex-title">
      ${heading}
      <div class="task">
        <p class="prompt">In B6, add up the sales in B2 to B5.</p>
        <p class="checks">This exercise checks that you use SUM, point at the cells, and get the right total.</p>
      </div>
      <form class="work" action="/exercises/add-up-a-column/">
        <div class="bar">
          <span class="namebox" aria-hidden="true">B6</span>
          <label class="visually-hidden" for="formula">Formula for B6</label>
          <input class="formula" id="formula" name="formula" type="text"${value} placeholder="=" autocomplete="off" autocapitalize="off" spellcheck="false" />
          ${action}
        </div>
        <div class="verdict" role="status">${verdict(state)}</div>
      </form>
      <div class="sheet">
${grid(state)}
      </div>
      ${state === "correct" ? "" : `<p class="help"><button class="secondary" type="button">Show a hint</button></p>`}
    </section>`;
}

const NAV = ["Exercises", "Functions", "Progress"];

function page(d: Direction, title: string, kind: "landing" | "exercise", body: string): string {
  const links = NAV.map((n) => `<li><a href="/${n.toLowerCase()}/">${n}</a></li>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <title>${title}</title>
  <link rel="stylesheet" href="../base.css" />
  <link rel="stylesheet" href="tokens.css" />
  <link rel="stylesheet" href="direction.css" />
</head>
<body class="page-${kind} dir-${d.id}">
  <a class="skip" href="#formula">Skip to the formula</a>
  <header class="site">
    <a class="brand" href="landing.html">Formula Practice</a>
    <nav class="nav-wide" aria-label="Main"><ul>${links}</ul></nav>
    <button class="menu" type="button" commandfor="menu" command="show-modal">Menu</button>
    <dialog id="menu" aria-label="Menu">
      <nav aria-label="Main"><ul>${links}</ul></nav>
      <button type="button" commandfor="menu" command="close">Close</button>
    </dialog>
  </header>
  <main id="main">
${body}
  </main>
  <footer class="site">
    <ul>
      <li><a href="/exercises/">Exercises</a></li>
      <li><a href="/functions/">Functions</a></li>
      <li><a href="/progress/">Progress</a></li>
      <li><a href="/privacy/">Privacy</a></li>
      <li><a href="/contact/">Contact</a></li>
    </ul>
  </footer>
</body>
</html>
`;
}

function landing(d: Direction): string {
  return page(
    d,
    "Practice Excel formulas on real grids",
    "landing",
    `    <div class="intro">
      <h1>Practice Excel formulas on real grids</h1>
      <p class="lede">Type one formula and press Enter. You see what it read, and why it is right or wrong.</p>
    </div>
${exercise("initial", 2)}
    <section class="after" aria-labelledby="free">
      <h2 id="free">What is free</h2>
      <p>Every exercise is free, and you never need an account. Your progress stays in this browser.</p>
      <h2 id="first">The first exercises</h2>
      <ol class="list">
        <li><a href="/exercises/add-up-a-column/">Add up a column</a> <span class="fn">SUM</span></li>
        <li><a href="/exercises/find-the-average/">Find the average</a> <span class="fn">AVERAGE</span></li>
        <li><a href="/exercises/find-the-largest-and-smallest/">Find the largest and smallest</a> <span class="fn">MAX, MIN</span></li>
        <li><a href="/exercises/count-the-numbers/">Count the numbers</a> <span class="fn">COUNT</span></li>
        <li><a href="/exercises/count-the-filled-cells/">Count the filled cells</a> <span class="fn">COUNTA</span></li>
      </ol>
      <p><a href="/exercises/">All exercises</a></p>
    </section>`,
  );
}

function exercisePage(d: Direction, state: State): string {
  return page(
    d,
    `Add up a column (${state === "wrong" ? "wrong answer" : "correct answer"})`,
    "exercise",
    `    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/exercises/">Exercises</a></li><li><a href="/topics/totals/">Totals</a></li></ol></nav>
    <h1>Add up a column</h1>
    <p class="count">Exercise 1 of 24 in Totals</p>
${exercise(state, null)}`,
  );
}

function tokensCss(d: Direction): string {
  const keys = Object.keys(d.light) as (keyof Theme)[];
  const vars = keys.map((k) => `  --${k}: light-dark(${d.light[k]}, ${d.dark[k]});`).join("\n");
  const face = (f: { family: string; file: string }, w: number) =>
    `@font-face {\n  font-family: "${f.family}";\n  src: url("../fonts/${f.file}-latin-${w}-normal.woff2") format("woff2");\n  font-weight: ${w};\n  font-display: swap;\n}`;
  return `/* Generated by docs/directions/build.ts from tokens.ts. */
${[400, 600].map((w) => face(d.textFont, w)).join("\n")}
${[400, 600].map((w) => face(d.monoFont, w)).join("\n")}
:root {
  color-scheme: light dark;
  --font-text: "${d.textFont.family}", system-ui, sans-serif;
  --font-mono: "${d.monoFont.family}", ui-monospace, monospace;
${vars}
}
`;
}

for (const d of DIRECTIONS) {
  const dir = `docs/directions/${d.id}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/tokens.css`, tokensCss(d));
  writeFileSync(`${dir}/landing.html`, landing(d));
  writeFileSync(`${dir}/exercise-wrong.html`, exercisePage(d, "wrong"));
  writeFileSync(`${dir}/exercise-correct.html`, exercisePage(d, "correct"));
}
console.log(`Wrote mocks for ${DIRECTIONS.map((d) => d.name).join(", ")}.`);
