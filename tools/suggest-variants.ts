// Why this exists: Phase 2 fixes for wrong formulas that pass. For each screen
// whose mutants Excel and the grader both accept, it proposes variants that
// separate them (tools/lib/variant-search.ts) and, with --apply, adds them to
// the content file with the fragile miss text a variant needs. Excel results
// come from the audit cache; run tools/audit-tasks.ts again afterwards so Excel
// checks every new variant.
// Refused changes live in tools/audit/variant-skips.json; run `npx biome format --write content` after --apply.
// Usage: node tools/suggest-variants.ts [--only=<id>] [--apply]
import { readFileSync, writeFileSync } from "node:fs";
import { isMap, parseDocument } from "yaml";
import {
  candidatesOf,
  judgeCandidate,
  loadAuditFixture,
  loadTasks,
  sheetsOf,
} from "./lib/audit-tasks.ts";
import { runInExcel } from "./lib/excel-bridge.ts";
import { proposeVariants } from "./lib/variant-search.ts";

const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const APPLY = process.argv.includes("--apply");
const FRAGILE =
  "The data can change, so the formula must calculate the result from the cells. A typed value, or a formula that is right by chance, will not follow the change.";
const TODAY = new Date().toISOString().slice(0, 10);

const SKIPS = JSON.parse(readFileSync("tools/audit/variant-skips.json", "utf8")) as Record<
  string,
  Record<string, string | number | boolean | null>[] | "*"
>;
const edits = new Map<string, { index: number; variants: object[] }[]>();
for (const t of loadTasks().filter((x) => !ONLY || x.id === ONLY)) {
  const fixture = loadAuditFixture(t);
  const sheets = sheetsOf(t.screen);
  const candidates = candidatesOf(t, fixture);
  const excel = runInExcel(
    candidates.flatMap((c) =>
      sheets.map((sh) => ({ rows: sh.rows, formula: c.formula, cell: t.screen.answerCell })),
    ),
    "tools/audit/excel-cache.json",
    { cacheOnly: true },
  );
  // Candidates the grader already rejects are never sent to Excel, so only the
  // fully cached ones are judged.
  const judged = candidates.flatMap((c, i) => {
    const results = excel.slice(i * sheets.length, (i + 1) * sheets.length);
    return results.some((e) => e.invalid === "not cached") ? [] : [judgeCandidate(t, c, results)];
  });
  const equivalent = new Set((fixture.equivalent ?? []).map((e) => e.formula));
  const wrong = judged
    .filter((j) => j.outcome === "survivor" && !equivalent.has(j.candidate.formula))
    .map((j) => j.candidate.formula);
  if (!wrong.length) continue;
  const keep = judged
    .filter((j) => j.excelRight && j.verdict.correct && j.candidate.source !== "mutant")
    .map((j) => j.candidate.formula);
  const skip = SKIPS[`${t.kind}/${t.id}#${t.index + 1}`] ?? [];
  if (skip === "*") continue;
  const { proposals, unkilled, blocked } = proposeVariants(t, wrong, keep, 4, skip);
  console.log(
    `${t.kind}/${t.id}#${t.index + 1}: ${wrong.length} survivors, ${proposals.length} variants, ${unkilled.length} left`,
  );
  for (const p of proposals)
    console.log(
      `   + set ${JSON.stringify(p.set)} expected ${JSON.stringify(p.expected)} kills ${p.kills.length}`,
    );
  for (const f of unkilled) console.log(`   ? ${f}`);
  if (blocked)
    console.log(
      `   ! set ${JSON.stringify(blocked.set)} would catch ${blocked.kills.length} but fails accepted ${blocked.blockers.join("  ")}`,
    );
  if (proposals.length) {
    const list = edits.get(t.file) ?? [];
    list.push({
      index: t.index,
      variants: proposals.map((p) => ({ set: p.set, expected: p.expected })),
    });
    edits.set(t.file, list);
  }
}

if (APPLY)
  for (const [file, screens] of edits) {
    const doc = parseDocument(readFileSync(file, "utf8"));
    for (const { index, variants } of screens) {
      const old =
        (
          doc.getIn(["screens", index, "variants"]) as { toJSON(): object[] } | undefined
        )?.toJSON() ?? [];
      const list = doc.createNode([...old, ...variants], { flow: false });
      // One variant per line, as the content files write them.
      for (const item of list.items) if (isMap(item)) item.flow = true;
      doc.setIn(["screens", index, "variants"], list);
      if (!doc.getIn(["screens", index, "misses", "fragile"]))
        doc.setIn(["screens", index, "misses", "fragile"], FRAGILE);
    }
    doc.set("updated", TODAY);
    writeFileSync(file, doc.toString({ lineWidth: 0, flowCollectionPadding: false }));
    console.log(`wrote ${file}`);
  }
