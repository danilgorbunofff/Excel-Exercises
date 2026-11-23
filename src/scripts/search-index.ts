// Why this exists: one fetch of the search index, shared by the header
// suggestions and the large search window, so the file loads once per page.
import type { SearchItem } from "../lib/search.ts";

let index: Promise<SearchItem[]> | null = null;
export const loadIndex = (): Promise<SearchItem[]> => {
  index ??= fetch("/search-index.json")
    .then((r) => (r.ok ? (r.json() as Promise<SearchItem[]>) : []))
    .catch(() => []);
  return index;
};
