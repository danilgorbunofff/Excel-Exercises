// Why this exists: the search entries that are not exercises, functions,
// tracks or articles: the reference pages. Pure, so it
// is unit-tested without the content collections.
import type { SearchItem } from "./search.ts";

/** The tool and reference pages, with the words people search for them by. */
export function pageItems(): SearchItem[] {
  return [
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
      title: "Home",
      url: "/home/",
      keywords: "home, my progress, streak, solved, due for review, scoreboard, clear",
    },
    {
      title: "Pricing",
      url: "/pricing/",
      keywords: "PRO, pricing, plans, subscribe, paid, upgrade, practice tests",
    },
  ].map((p) => ({ ...p, kind: "Page" as const }));
}
