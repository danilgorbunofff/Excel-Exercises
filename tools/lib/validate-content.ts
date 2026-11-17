// Why this exists: checks every content file against the schema and checks the
// links between files, such as the single track order. CI runs it on each push.
import {
  dailySchema,
  exerciseSchema,
  functionSchema,
  mockSchema,
  trackSchema,
} from "../../src/content/schema.ts";

export interface SourceFile {
  file: string;
  data: unknown;
}

function issuesOf(file: string, error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map(
    (i) => `${file}: ${i.path.map(String).join(".") || "(root)"}: ${i.message}`,
  );
}

/**
 * The checkable part of the level-3 rubric in docs/content.md: the prompt asks
 * a question rather than naming the function, and the formula is tested on
 * changed data or spills a whole block.
 */
/**
 * A required function must be stated where the learner reads it, in the prompt
 * or the title, so "This exercise asks for X" is true.
 */
export function unstatedRequirements(ex: {
  title: string;
  screens: readonly { prompt: string; requiredFunctions: readonly string[] }[];
}): string[] {
  const out: string[] = [];
  ex.screens.forEach((s, i) => {
    // Case matters: the word "and" or "sum" in a sentence does not name AND or SUM.
    for (const name of s.requiredFunctions)
      if (!new RegExp(`\\b${name}\\b`, "u").test(`${s.prompt} ${ex.title}`))
        out.push(
          `screens.${i}.requiredFunctions: ${name} is required but neither the prompt nor the title names it`,
        );
  });
  return out;
}

export function advancedProblems(ex: {
  level: number;
  screens: readonly {
    prompt: string;
    requiredFunctions: readonly string[];
    expected: unknown;
    variants?: unknown;
  }[];
}): string[] {
  if (ex.level !== 3) return [];
  const out: string[] = [];
  ex.screens.forEach((s, i) => {
    // The prompt asks the business question only, so any formula Excel finds right must pass.
    if (s.requiredFunctions.length > 0)
      out.push(
        `screens.${i}.requiredFunctions: a level-3 screen requires no function; the learner chooses, and any right formula passes`,
      );
  });
  if (!ex.screens.some((s) => s.variants || Array.isArray(s.expected))) {
    out.push(
      "screens: a level-3 exercise needs variants or a spilled answer on at least one screen",
    );
  }
  return out;
}

/** Returns a list of readable errors. An empty list means the content is valid. */
export function validateContent(
  exercises: readonly SourceFile[],
  track: SourceFile,
  functions: readonly SourceFile[] = [],
  daily: readonly SourceFile[] = [],
  mocks: readonly SourceFile[] = [],
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
    errors.push(...advancedProblems(ex).map((e) => `${file}: ${e}`));
    errors.push(...unstatedRequirements(ex).map((e) => `${file}: ${e}`));
    if (ids.has(ex.id)) errors.push(`${file}: id "${ex.id}" is also used by ${ids.get(ex.id)}`);
    ids.set(ex.id, file);
    slugs.set(ex.slug, (slugs.get(ex.slug) ?? 0) + 1);
    topicsUsed.push({ file, topic: ex.topic });
  }
  // Daily tasks: their own ids, never in the track, and every step of the week filled.
  const tiers = new Set<number>();
  for (const { file, data } of daily) {
    const parsed = dailySchema.safeParse(data);
    if (!parsed.success) {
      errors.push(...issuesOf(file, parsed.error));
      continue;
    }
    const task = parsed.data;
    errors.push(...advancedProblems(task).map((e) => `${file}: ${e}`));
    // Owner rule: a daily task stands alone, so any correct formula passes.
    task.screens.forEach((sc, i) => {
      for (const name of sc.requiredFunctions)
        errors.push(
          `${file}: screens.${i}.requiredFunctions: a daily task requires no function, so drop ${name}`,
        );
    });
    if (ids.has(task.id))
      errors.push(`${file}: id "${task.id}" is also used by ${ids.get(task.id)}`);
    ids.set(task.id, file);
    tiers.add(task.tier);
  }
  if (daily.length > 0) {
    for (let t = 1; t <= 7; t++) {
      if (!tiers.has(t)) errors.push(`content/daily: no task for step ${t} of the week`);
    }
  }
  // Mock tasks: held out for the timed sets, so never in the track either.
  for (const { file, data } of mocks) {
    const parsed = mockSchema.safeParse(data);
    if (!parsed.success) {
      errors.push(...issuesOf(file, parsed.error));
      continue;
    }
    const task = parsed.data;
    errors.push(...advancedProblems(task).map((e) => `${file}: ${e}`));
    errors.push(...unstatedRequirements(task).map((e) => `${file}: ${e}`));
    if (task.screens.some((s) => s.requiredFunctions.length > 0))
      errors.push(`${file}: a mock task requires no function; the prompt is the whole brief`);
    if (ids.has(task.id))
      errors.push(`${file}: id "${task.id}" is also used by ${ids.get(task.id)}`);
    ids.set(task.id, file);
  }
  const dailyIds = new Set([...daily, ...mocks].map((d) => (d.data as { id?: string } | null)?.id));

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
    if (dailyIds.has(id)) {
      if (counts.has(id))
        errors.push(`${track.file}: "${id}" is a daily or mock task and cannot be in the order`);
      continue;
    }
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
