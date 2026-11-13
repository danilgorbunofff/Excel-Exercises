// Why this exists: the function reference pages, and which functions the
// exercises practise, so the function index and the links agree.
import { type CollectionEntry, getCollection } from "astro:content";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { type FunctionIndex, functionIndexSchema } from "../content/schema.ts";
import { exercisePath, functionsOf, type Placed } from "./exercises.ts";

let indexCache: FunctionIndex | null = null;
/** The function cards and task groups from content/function-index.yaml. */
export function loadFunctionIndex(): FunctionIndex {
  indexCache ??= functionIndexSchema.parse(
    parse(readFileSync("content/function-index.yaml", "utf8")),
  );
  return indexCache;
}

export type FunctionEntry = CollectionEntry<"functions">["data"];

export const functionPath = (slug: string) => `/functions/${slug}/`;

export async function functionPages(): Promise<FunctionEntry[]> {
  return (await getCollection("functions"))
    .map((e) => e.data)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every function a seed exercise requires, with those exercises in track order. */
export function functionsPractised(placed: readonly Placed[]) {
  const map = new Map<string, { title: string; href: string }[]>();
  for (const p of placed) {
    for (const name of functionsOf(p.exercise)) {
      const list = map.get(name) ?? [];
      list.push({ title: p.exercise.title, href: exercisePath(p.exercise.slug) });
      map.set(name, list);
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}
