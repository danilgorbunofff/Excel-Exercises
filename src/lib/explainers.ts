// Why this exists: the formula walkthroughs and their paths, read once from
// content/explainers.yaml.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { type Explainers, explainersSchema } from "../content/schema.ts";
import { loadFunctionIndex } from "./functions.ts";

export const explainerPath = "/formula-explainer/";
export const walkthroughPath = (slug: string) => `/formula-explainer/${slug}/`;

let cache: Explainers | null = null;
export function loadExplainers(): Explainers {
  cache ??= explainersSchema.parse(parse(readFileSync("content/explainers.yaml", "utf8")));
  return cache;
}

/** What each function does, in one line, for the explainer's notes. */
export function functionSummaries(): Record<string, string> {
  return Object.fromEntries(loadFunctionIndex().functions.map((f) => [f.name, f.summary]));
}
