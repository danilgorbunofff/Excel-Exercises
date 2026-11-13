// Why this exists: writes docs/directions/index.html, one page that links every
// mock and shows every screenshot, so the owner can compare the directions.
// Run after shoot.ts: node docs/directions/gallery.ts
import { writeFileSync } from "node:fs";
import { DIRECTIONS } from "./tokens.ts";

const PAGES = [
  ["landing", "Home"],
  ["exercise-wrong", "Exercise, wrong answer"],
  ["exercise-correct", "Exercise, correct answer"],
] as const;

const sections = DIRECTIONS.map((d) => {
  const rows = PAGES.map(([p, label]) => {
    const shots = ["375-light", "375-dark", "1280-light", "1280-dark"]
      .map(
        (s) =>
          `<a href="shots/${d.id}-${p}-${s}.jpg"><img src="shots/${d.id}-${p}-${s}.jpg" alt="${d.name}, ${label}, ${s.replace("-", " px, ")}" loading="lazy" width="${s.startsWith("375") ? 150 : 320}"></a>`,
      )
      .join("\n        ");
    return `    <h3>${label}: <a href="${d.id}/${p}.html">open the mock</a></h3>\n    <div class="shots">\n        ${shots}\n    </div>`;
  }).join("\n");
  return `  <section>\n    <h2>${d.name}</h2>\n${rows}\n  </section>`;
}).join("\n");

writeFileSync(
  "docs/directions/index.html",
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Phase 2 directions</title>
  <style>
    body { font: 16px/1.5 system-ui, sans-serif; margin: 0 auto; max-width: 80rem; padding: 1rem; }
    .shots { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-start; }
    img { border: 1px solid #888; height: auto; }
  </style>
</head>
<body>
  <h1>Phase 2 directions</h1>
  <p>Shots at 375 and 1280 px, light and dark. Rationale and the recommendation are in docs/directions.md.</p>
${sections}
</body>
</html>
`,
);
console.log("Wrote docs/directions/index.html");
