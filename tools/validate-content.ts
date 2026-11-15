// Why this exists: the CI entry point for content validation. It reads every
// exercise and the track file, then prints each problem with its file.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { assessmentsSchema } from "../src/content/schema.ts";
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
  const facts = exerciseFiles.map((f) => {
    const d = read(f).data as { id?: string; pro?: boolean; screens?: unknown[] };
    return { id: String(d.id), pro: d.pro === true, screens: d.screens?.length ?? 0 };
  });
  errors.push(
    ...checkAssessments(assessments.data, facts).map((e) => `content/assessments.yaml: ${e}`),
  );
}

if (errors.length > 0) {
  console.error(`Content validation failed with ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(
  `Content valid: ${exerciseFiles.length} exercise file(s), ${functionFiles.length} function page(s), the track file and the assessment sets.`,
);
