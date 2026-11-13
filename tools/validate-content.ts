// Why this exists: the CI entry point for content validation. It reads every
// exercise and the track file, then prints each problem with its file.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
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

if (errors.length > 0) {
  console.error(`Content validation failed with ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(
  `Content valid: ${exerciseFiles.length} exercise file(s), ${functionFiles.length} function page(s) and the track file.`,
);
