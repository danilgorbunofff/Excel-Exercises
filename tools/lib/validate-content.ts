// Why this exists: checks every content file against the schema and checks the
// links between files, such as the single track order. CI runs it on each push.
import { exerciseSchema, functionSchema, trackSchema } from "../../src/content/schema.ts";

export interface SourceFile {
  file: string;
  data: unknown;
}

function issuesOf(file: string, error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map(
    (i) => `${file}: ${i.path.map(String).join(".") || "(root)"}: ${i.message}`,
  );
}

/** Returns a list of readable errors. An empty list means the content is valid. */
export function validateContent(
  exercises: readonly SourceFile[],
  track: SourceFile,
  functions: readonly SourceFile[] = [],
): string[] {
  const errors: string[] = [];
  const ids = new Map<string, string>();
  const slugs = new Map<string, number>();
  const topicsUsed: { file: string; topic: string }[] = [];

  for (const { file, data } of exercises) {
    const parsed = exerciseSchema.safeParse(data);
    if (!parsed.success) {
      errors.push(...issuesOf(file, parsed.error));
      // Keep the id and topic so the track checks do not also report them.
      const { id, topic } = (data ?? {}) as { id?: unknown; topic?: unknown };
      if (typeof id === "string") ids.set(id, file);
      if (typeof topic === "string") topicsUsed.push({ file, topic });
      continue;
    }
    const ex = parsed.data;
    if (ids.has(ex.id)) errors.push(`${file}: id "${ex.id}" is also used by ${ids.get(ex.id)}`);
    ids.set(ex.id, file);
    slugs.set(ex.slug, (slugs.get(ex.slug) ?? 0) + 1);
    topicsUsed.push({ file, topic: ex.topic });
  }
  for (const [slug, n] of slugs) {
    if (n > 1) errors.push(`slug "${slug}" is used by more than one exercise`);
  }

  const parsedTrack = trackSchema.safeParse(track.data);
  if (!parsedTrack.success) return [...errors, ...issuesOf(track.file, parsedTrack.error)];
  const { topics, order } = parsedTrack.data;

  const topicSlugs = new Set(topics.map((t) => t.slug));
  for (const { file, topic } of topicsUsed) {
    if (!topicSlugs.has(topic)) errors.push(`${file}: unknown topic "${topic}"`);
  }
  const usedTopics = new Set(topicsUsed.map((t) => t.topic));
  for (const slug of topicSlugs) {
    if (!usedTopics.has(slug)) errors.push(`${track.file}: topic "${slug}" has no exercises`);
  }

  const counts = new Map<string, number>();
  for (const id of order) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) {
    if (n > 1) errors.push(`${track.file}: "${id}" appears ${n} times in the order`);
    if (!ids.has(id)) errors.push(`${track.file}: "${id}" has no exercise file`);
  }
  for (const [id, file] of ids) {
    if (!counts.has(id)) errors.push(`${file}: "${id}" is not in the track order`);
  }

  const names = new Map<string, string>();
  for (const { file, data } of functions) {
    const parsed = functionSchema.safeParse(data);
    if (!parsed.success) {
      errors.push(...issuesOf(file, parsed.error));
      continue;
    }
    const fn = parsed.data;
    if (names.has(fn.name))
      errors.push(`${file}: ${fn.name} also has a page in ${names.get(fn.name)}`);
    names.set(fn.name, file);
    if (fn.slug !== fn.name.toLowerCase())
      errors.push(`${file}: slug should be "${fn.name.toLowerCase()}"`);
    if (!ids.has(fn.exercise))
      errors.push(`${file}: exercise "${fn.exercise}" has no exercise file`);
  }
  return errors;
}
