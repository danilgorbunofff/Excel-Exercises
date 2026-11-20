// Why this exists: one ranking for the header suggestions and the search page,
// so both show the same results in the same order. Pure, so it is unit-tested.

export type SearchKind = "Exercise" | "Track" | "Function" | "Article" | "Page";

export interface SearchItem {
  title: string;
  url: string;
  kind: SearchKind;
  /** Extra words that should find this item: function names, the track, a summary. */
  keywords: string;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/gu, " ").trim();

/** Scores one item. 0 means no match. Every word of the query must match somewhere. */
export function score(item: SearchItem, query: string): number {
  const q = norm(query);
  if (!q) return 0;
  const title = norm(item.title);
  const keys = norm(item.keywords);
  let total = 0;
  for (const word of q.split(" ")) {
    if (title === word) total += 100;
    else if (title.startsWith(word)) total += 40;
    else if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "u").test(title))
      total += 25;
    else if (title.includes(word)) total += 10;
    else if (keys.includes(word)) total += 5;
    else return 0;
  }
  if (title === q) total += 200;
  // Functions answer a name search best, then exercises.
  if (item.kind === "Function") total += 3;
  return total;
}

export function search(
  items: readonly SearchItem[],
  query: string,
  limit = Infinity,
): SearchItem[] {
  return items
    .map((item, i) => ({ item, i, s: score(item, query) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((r) => r.item);
}
