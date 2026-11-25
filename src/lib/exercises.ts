// Why this exists: the exercises in the one track order, with their topic,
// position and the next exercise. Every page that lists or links exercises
// reads this, so there is no second order anywhere.

import { type CollectionEntry, getCollection } from "astro:content";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { IconName } from "../components/Icon.astro";
import { type Track, trackSchema } from "../content/schema.ts";
import { coverOf, loadAssessments, skillsOf } from "./assessments.ts";
import { originalSlot, type Rung, stepPath } from "./steps.ts";

export type ExerciseEntry = CollectionEntry<"exercises">;

export interface Placed {
  exercise: ExerciseEntry["data"];
  /** 1-based position in the track. */
  number: number;
  total: number;
  topic: Track["topics"][number];
  /** Position within its topic, 1-based, and the topic's size. */
  topicNumber: number;
  topicTotal: number;
  next: ExerciseEntry["data"] | null;
}

let trackCache: Track | null = null;
export function loadTrack(): Track {
  trackCache ??= trackSchema.parse(parse(readFileSync("content/track.yaml", "utf8")));
  return trackCache;
}

export async function placedExercises(): Promise<Placed[]> {
  const track = loadTrack();
  const byId = new Map((await getCollection("exercises")).map((e) => [e.data.id, e.data]));
  const ordered = track.order.map((id) => {
    const ex = byId.get(id);
    if (!ex) throw new Error(`track.yaml names "${id}", which has no exercise file`);
    return ex;
  });
  return ordered.map((exercise, i) => {
    const topic = track.topics.find((t) => t.slug === exercise.topic);
    if (!topic) throw new Error(`${exercise.id} has unknown topic ${exercise.topic}`);
    const inTopic = ordered.filter((e) => e.topic === exercise.topic);
    return {
      exercise,
      number: i + 1,
      total: ordered.length,
      topic,
      topicNumber: inTopic.indexOf(exercise) + 1,
      topicTotal: inTopic.length,
      next: ordered[i + 1] ?? null,
    };
  });
}

/**
 * The daily-only tasks from content/daily/, shaped like a placed exercise so
 * the workbench can show them. number is the step of the week, total is 7.
 * They are not in the track, so no list, search or sitemap includes them.
 */
export async function dailyTasks(): Promise<(Placed & { tier: number })[]> {
  const topic = {
    slug: "daily",
    title: "Daily exercise",
    summary: "",
    group: "skill" as const,
    learn: [],
  };
  return (await getCollection("daily")).map(({ data }) => ({
    exercise: {
      ...data,
      topic: "daily",
      notes: { summary: "", syntax: "", example: "", commonErrors: [] },
    },
    tier: data.tier,
    number: data.tier,
    total: 7,
    topic,
    topicNumber: 1,
    topicTotal: 1,
    next: null,
  }));
}

export type Drill = Placed & { fn: string };

/**
 * The PRO function drills from content/drills/, shaped like a placed exercise
 * so the workbench can show them. Sorted by function, then level, then id, so
 * a session runs each function from easy to hard. No list, search or sitemap
 * includes them.
 */
export async function drillTasks(): Promise<Drill[]> {
  const topic = {
    slug: "drills",
    title: "Function practice",
    summary: "",
    group: "skill" as const,
    learn: [],
  };
  const all = (await getCollection("drills"))
    .map((e) => e.data)
    .sort(
      (a, b) =>
        a.function.localeCompare(b.function) || a.level - b.level || a.id.localeCompare(b.id),
    );
  return all.map((data) => {
    const same = all.filter((d) => d.function === data.function);
    return {
      exercise: {
        ...data,
        topic: "drills",
        notes: { summary: "", syntax: "", example: "", commonErrors: [] },
      },
      fn: data.function,
      number: same.indexOf(data) + 1,
      total: same.length,
      topic,
      topicNumber: 1,
      topicTotal: 1,
      next: null,
    };
  });
}

/** The next few exercises in track order after this one, wrapping round to the start. */
export const moreAfter = (all: readonly Placed[], placed: Placed): Placed[] => {
  const i = all.indexOf(placed);
  return [1, 2, 3]
    .map((d) => all[(i + d) % all.length])
    .filter((p): p is Placed => p !== undefined && p !== placed);
};

/** A ladder step: shaped like its exercise, with the same topic, place and next, so it shares the lock. */
export type LadderStep = Placed & { parent: Placed; step: number };

/** The ladder steps from content/steps/, each placed where its exercise is. */
export async function stepTasks(): Promise<LadderStep[]> {
  const byId = new Map((await placedExercises()).map((p) => [p.exercise.id, p]));
  return (await getCollection("steps")).flatMap(({ data }) => {
    const parent = byId.get(data.parent);
    if (!parent) return [];
    const { parent: _p, step, ...task } = data;
    return [
      {
        ...parent,
        exercise: { ...task, topic: parent.exercise.topic, notes: parent.exercise.notes },
        parent,
        step,
      },
    ];
  });
}

/** Each exercise's ladder, by exercise id, in step order: the exercise in its slot and its steps. Exercises without steps have none. */
export function laddersOf(steps: readonly LadderStep[]): Map<string, Rung[]> {
  const out = new Map<string, Rung[]>();
  for (const s of steps) {
    const id = s.parent.exercise.id;
    out.set(id, [
      ...(out.get(id) ?? []),
      { id: s.exercise.id, step: s.step, href: stepPath(s.parent.exercise.slug, s.step) },
    ]);
  }
  for (const [id, rungs] of out) {
    const slot = originalSlot(rungs.map((r) => r.step));
    const parent = steps.find((s) => s.parent.exercise.id === id)?.parent;
    // A ladder still being written shows nowhere.
    if (slot === null || !parent) out.delete(id);
    else
      out.set(
        id,
        [...rungs, { id, step: slot, href: exercisePath(parent.exercise.slug) }].sort(
          (a, b) => a.step - b.step,
        ),
      );
  }
  return out;
}

/** Where a drill session starts: one function, or a single drill by id. */
export const drillsPath = (fn?: string) =>
  fn ? `/exercises/drills/?fn=${encodeURIComponent(fn)}` : "/exercises/drills/";

export const LEVELS = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" } as const;

export const exercisePath = (slug: string) => `/exercises/${slug}/`;
/** A topic is shown to visitors as a learning track. */
export const topicPath = (slug: string) => `/exercises/tracks/${slug}/`;
export const tracksPath = "/exercises/tracks/";
/** The catalogue, filtered to the exercises that require one function. */
export const exercisesForFunction = (name: string) => `/exercises/?fn=${encodeURIComponent(name)}`;

/** A rough time for one exercise, by level, used for track estimates. */
export const estimatedMinutes = (level: number) => (level >= 3 ? 12 : level === 2 ? 8 : 5);

/** "45 min", "1 hr 20 min". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export interface TrackSummary {
  topic: Placed["topic"];
  /** 1-based position of the track. */
  number: number;
  exercises: Placed[];
  minutes: number;
  functions: string[];
  /** The track's usual level: the rounded average of its exercises. */
  level: 1 | 2 | 3;
}

/** The tracks in order, each with its exercises in track order. */
export function trackSummaries(placed: readonly Placed[]): TrackSummary[] {
  return loadTrack().topics.map((topic, i) => {
    const exercises = placed.filter((p) => p.topic.slug === topic.slug);
    return {
      topic,
      number: i + 1,
      exercises,
      minutes: exercises.reduce((sum, p) => sum + estimatedMinutes(p.exercise.level), 0),
      functions: [...new Set(exercises.flatMap((p) => functionsOf(p.exercise)))],
      level: Math.min(
        3,
        Math.max(
          1,
          Math.round(
            exercises.reduce((sum, p) => sum + p.exercise.level, 0) / Math.max(1, exercises.length),
          ),
        ),
      ) as 1 | 2 | 3,
    };
  });
}

/** The numbered steps on the exercise page, built from one screen. */
export function stepsFor(screen: { answerCell: string; prompt: string }): string[] {
  // Step 1 already names the cell, so "In B6, add up..." becomes "Add up...".
  const lead = new RegExp(`^In ${screen.answerCell},\\s*`, "u");
  const task = screen.prompt.replace(lead, "");
  const step = task === screen.prompt ? task : task.charAt(0).toUpperCase() + task.slice(1);
  return [`Click cell ${screen.answerCell}.`, step, "Press Enter or select Check."];
}

/** Where Next goes from each screen: the next screen, then the next exercise in the track. */
export function nextAction(placed: Placed, screenIndex: number) {
  const { exercise, next } = placed;
  if (screenIndex < exercise.screens.length - 1) {
    return { href: "", label: "Next step", isStep: true };
  }
  return next
    ? { href: exercisePath(next.slug), label: `Next: ${next.title}`, isStep: false }
    : { href: "/exercises/", label: "All exercises", isStep: false };
}

/** What the exercise script needs. The answer is already on the page, in hint 3. */
/** The data the exercise script grades with. A locked exercise leaves the answers out. */
export function exerciseData(
  exercise: Pick<ExerciseEntry["data"], "id" | "screens">,
  withAnswers = true,
) {
  return {
    id: exercise.id,
    screens: exercise.screens.map((s) => ({
      spec: {
        rows: s.rows,
        answerCell: s.answerCell,
        expected: s.expected,
        requiredFunctions: s.requiredFunctions,
        forbiddenFunctions: s.forbiddenFunctions,
        requireReference: s.requireReference,
        ...(s.variants ? { variants: s.variants } : {}),
      },
      answer: withAnswers ? s.answer : "",
      misses: s.misses,
    })),
  };
}

/** "SUM", "COUNT and COUNTA", "IF, AND and OR". */
export const listWords = (items: readonly string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** The functions an exercise practises: each screen's required ones, or else those of its answer. */
export const functionsOf = (exercise: ExerciseEntry["data"]) => [
  ...new Set(exercise.screens.flatMap((s) => skillsOf(s))),
];

// The job sets go under the job's name; every set is the same card.
const SET_LOOKS: Record<string, { name?: string; icon: IconName }> = {
  "office-essentials": { name: "Office or admin", icon: "briefcase" },
  "data-analyst": { name: "Data analyst", icon: "chart" },
  finance: { name: "Finance or accounting", icon: "percent" },
  sample: { icon: "play" },
  beginner: { icon: "sigma" },
  intermediate: { icon: "formula" },
};

/**
 * The mock assessment sets as cards, for /mock-assessments/ and the account's
 * Certificates page: the icon, the name shown, and the level, which is the
 * hardest task's.
 */
export async function assessmentCards() {
  const byId = new Map(
    [...(await getCollection("exercises")), ...(await getCollection("mocks"))].map((e) => [
      e.data.id,
      e.data,
    ]),
  );
  return loadAssessments().sets.map((set) => {
    const level = (coverOf(set, byId).levels.at(-1) ?? 1) as 1 | 2 | 3;
    const look = SET_LOOKS[set.slug];
    return {
      ...set,
      level,
      levelName: LEVELS[level],
      name: look?.name ?? set.title,
      icon: look?.icon ?? ("grid" satisfies IconName),
      job: look?.name !== undefined,
    };
  });
}
