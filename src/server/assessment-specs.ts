// Why this exists: the grading spec of every exercise screen, for marking mock
// assessments on the server. The same shape the browser grades with
// (exerciseData), read from the exercises collection at run time.

import { getCollection } from "astro:content";
import type { GradeSpec } from "@practice/grader";
import type { SpecFor } from "../lib/assessments.ts";
import { exerciseData } from "../lib/exercises.ts";

let cache: Map<string, GradeSpec[]> | null = null;

export async function loadSpecs(): Promise<SpecFor> {
  cache ??= new Map(
    [...(await getCollection("exercises")), ...(await getCollection("mocks"))].map((e) => [
      e.data.id,
      exerciseData(e.data).screens.map((s) => s.spec),
    ]),
  );
  const specs = cache;
  return (exercise, screen) => specs.get(exercise)?.[screen] ?? null;
}
