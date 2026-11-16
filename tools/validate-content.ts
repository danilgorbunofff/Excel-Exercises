// Why this exists: the CI entry point for content validation. It reads every
// exercise and the track file, then prints each problem with its file.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { assessmentsSchema } from "../src/content/schema.ts";
import { isLocked, topicNumbers } from "../src/lib/access.ts";
import { checkAssessments } from "../src/lib/assessments.ts";
import { listFiles } from "./lib/fs.ts";
import { validateContent } from "./lib/validate-content.ts";

const read = (file: string) => ({ file, data: parse(readFileSync(file, "utf8")) as unknown });
const exerciseFiles = listFiles("content/exercises", (n) => n.endsWith(".yaml"));
const functionFiles = listFiles("content/functions", (n) => n.endsWith(".yaml"));
const errors = validateContent(
  exerciseFiles.map(read),
  read("content/track.yaml"),
  functionFiles.map(read),
);

// The assessment sets name exercises and screens; check they exist.
const assessments = assessmentsSchema.safeParse(read("content/assessments.yaml").data);
if (!assessments.success) {
  errors.push(
    ...assessments.error.issues.map(
      (i) => `content/assessments.yaml: ${i.path.join(".")}: ${i.message}`,
    ),
  );
} else {
  const files = exerciseFiles.map(
    (f) => read(f).data as { id?: string; topic?: string; screens?: unknown[] },
  );
  const topicOf = new Map(files.map((d) => [String(d.id), String(d.topic)]));
  const order = (read("content/track.yaml").data as { order?: string[] }).order ?? [];
  const numbers = topicNumbers(order, (id) => topicOf.get(id) ?? "");
  const facts = files.map((d) => ({
    id: String(d.id),
    locked: isLocked({ topicNumber: numbers.get(String(d.id)) ?? Number.POSITIVE_INFINITY }),
    screens: d.screens?.length ?? 0,
  }));
  errors.push(
    ...checkAssessments(assessments.data, facts).map((e) => `content/assessments.yaml: ${e}`),
  );
  // A track may link a mock assessment; the set must exist.
  const sets = new Set(assessments.data.sets.map((s) => s.slug));
  const topics =
    (read("content/track.yaml").data as { topics?: { slug: string; assessment?: string }[] })
      .topics ?? [];
  for (const t of topics) {
    if (t.assessment && !sets.has(t.assessment)) {
      errors.push(
        `content/track.yaml: topic "${t.slug}" links unknown assessment "${t.assessment}"`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`Content validation failed with ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(
  `Content valid: ${exerciseFiles.length} exercise file(s), ${functionFiles.length} function page(s), the track file and the assessment sets.`,
);
