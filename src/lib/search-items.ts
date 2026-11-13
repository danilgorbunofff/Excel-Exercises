// Why this exists: builds the list the search box and the search page read,
// from the same content the pages are built from.
import { allArticles, articlePath } from "./articles.ts";
import {
  exercisePath,
  exercisesForFunction,
  functionsOf,
  LEVELS,
  placedExercises,
  topicPath,
  trackSummaries,
} from "./exercises.ts";
import { loadExplainers } from "./explainers.ts";
import { functionPages, functionPath, loadFunctionIndex } from "./functions.ts";
import type { SearchItem } from "./search.ts";
import { pageItems, walkthroughItems } from "./search-pages.ts";

export async function searchItems(): Promise<SearchItem[]> {
  const placed = await placedExercises();
  const pages = new Map((await functionPages()).map((p) => [p.name, functionPath(p.slug)]));
  const functions: SearchItem[] = loadFunctionIndex().functions.map((f) => ({
    title: f.name,
    url: pages.get(f.name) ?? exercisesForFunction(f.name),
    kind: "Function",
    keywords: f.summary,
  }));
  const exercises: SearchItem[] = placed.map((p) => ({
    title: p.exercise.title,
    url: exercisePath(p.exercise.slug),
    kind: "Exercise",
    keywords: [
      ...functionsOf(p.exercise),
      p.topic.title,
      LEVELS[p.exercise.level as 1 | 2 | 3],
      p.exercise.screens[0]?.prompt ?? "",
    ].join(" "),
  }));
  const tracks: SearchItem[] = trackSummaries(placed).map((t) => ({
    title: t.topic.title,
    url: topicPath(t.topic.slug),
    kind: "Track",
    keywords: `${t.topic.summary} ${t.functions.join(" ")}`,
  }));
  const articles: SearchItem[] = (await allArticles()).map((a) => ({
    title: a.data.title,
    url: articlePath(a.id),
    kind: "Article",
    keywords: `${a.data.description} ${a.data.functions.join(" ")}`,
  }));
  return [
    ...functions,
    ...exercises,
    ...tracks,
    ...walkthroughItems(loadExplainers().walkthroughs),
    ...articles,
    ...pageItems(),
  ];
}
