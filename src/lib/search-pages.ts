// Why this exists: the search entries that are not exercises, functions,
// tracks or articles: the formula walkthroughs and the tool pages. Pure, so it
// is unit-tested without the content collections.
import type { SearchItem } from "./search.ts";

interface WalkthroughLike {
  slug: string;
  title: string;
  description: string;
  formula: string;
}

export function walkthroughItems(walkthroughs: readonly WalkthroughLike[]): SearchItem[] {
  return walkthroughs.map((w) => ({
    title: w.title,
    url: `/formula-explainer/${w.slug}/`,
    kind: "Walkthrough",
    keywords: `${w.description} ${w.formula}`,
  }));
}

/** The tool and reference pages, with the words people search for them by. */
export function pageItems(): SearchItem[] {
  return [
    {
      title: "Formula explainer",
      url: "/formula-explainer/",
      keywords: "explain a formula step by step, walkthrough, evaluate, parts",
    },
    {
      title: "Keyboard shortcuts",
      url: "/excel-shortcuts/",
      keywords: "Excel shortcuts, keys, hotkeys, Windows, Mac, Ctrl, Cmd",
    },
    {
      title: "Learning tracks",
      url: "/exercises/tracks/",
      keywords: "tracks, paths, courses, where to start, order",
    },
    {
      title: "Resources",
      url: "/resources/",
      keywords: "resources, guides, references, practice by goal, Microsoft Support",
    },
    {
      title: "Progress",
      url: "/progress/",
      keywords: "my progress, solved, due for review, history, clear",
    },
    {
      title: "Pricing",
      url: "/pricing/",
      keywords: "PRO, pricing, plans, subscribe, paid, upgrade, practice tests",
    },
  ].map((p) => ({ ...p, kind: "Page" as const }));
}
