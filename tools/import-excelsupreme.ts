// Why this exists: a one-off import of the owner's exercises from the earlier
// excelsupreme project. It writes one YAML file per exercise that can come
// over, never overwriting an existing file, and prints what it dropped and the
// order to paste into content/track.yaml. Usage:
//   node tools/import-excelsupreme.ts [path to excelsupreme]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Document, isMap, isSeq, visit } from "yaml";
import { convert, type SourceExercise, topicFor } from "./lib/import-excelsupreme.ts";

const root = process.argv[2] ?? "/Users/danil/Desktop/excelsupreme";
const sourceDir = join(root, "legacy/content/exercises");
const track = JSON.parse(readFileSync(join(root, "legacy/content/track.json"), "utf8")) as {
  lessons: { id: string; group: string }[];
};
const files = readdirSync(sourceDir).filter((f) => f.endsWith(".json"));
const today = new Date().toISOString().slice(0, 10);

/** Rows and reject entries on one line each, as the hand-written files have them. */
function toYaml(value: unknown): string {
  const doc = new Document(value);
  visit(doc, {
    Pair(_, pair) {
      const key = String((pair.key as { value?: unknown })?.value ?? "");
      if (key === "rows" && isSeq(pair.value)) {
        for (const row of pair.value.items) if (isSeq(row)) row.flow = true;
      }
      if (key === "reject" && isSeq(pair.value)) {
        for (const item of pair.value.items) if (isMap(item)) item.flow = true;
      }
      if ((key === "requiredFunctions" || key === "forbiddenFunctions") && isSeq(pair.value)) {
        pair.value.flow = true;
      }
    },
  });
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false });
}

const order = new Map<string, string[]>();
const report: string[] = [];
let written = 0;
for (const { id, group } of track.lessons) {
  const file = files.find((f) => f.startsWith(`${id.slice(0, 2)}-`));
  if (!file) continue;
  const src = JSON.parse(readFileSync(join(sourceDir, file), "utf8")) as SourceExercise;
  const fns = src.screens.flatMap((s) => (s.require ?? []).map((r) => r.func.toUpperCase()));
  const topic = topicFor(group, fns);
  if (!topic) {
    report.push(`${src.id}: skipped, group ${group} has no place here`);
    continue;
  }
  const { exercise, notes } = convert(src, topic, today);
  report.push(...notes);
  if (!exercise) continue;
  const out = join("content/exercises", `${exercise.slug}.yaml`);
  if (existsSync(out)) {
    report.push(`${src.id}: kept the existing ${out}`);
  } else {
    // An empty list is the default, so it is left out, as in the hand-written files.
    const screens = exercise.screens.map(({ forbiddenFunctions, ...rest }) =>
      forbiddenFunctions.length ? { ...rest, forbiddenFunctions } : rest,
    );
    writeFileSync(out, toYaml({ ...exercise, screens }));
    written++;
  }
  order.set(topic, [...(order.get(topic) ?? []), exercise.slug]);
}

console.log(report.join("\n"));
console.log(`\nWrote ${written} file(s). Order by topic:`);
for (const [topic, slugs] of order)
  console.log(`  # ${topic}\n${slugs.map((s) => `  - ${s}`).join("\n")}`);
