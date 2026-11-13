// Why this exists: the articles in one order, newest first, with their paths.
import { type CollectionEntry, getCollection } from "astro:content";

export type ArticleEntry = CollectionEntry<"articles">;

export const articlePath = (id: string) => `/articles/${id}/`;

export async function allArticles(): Promise<ArticleEntry[]> {
  return (await getCollection("articles")).sort(
    (a, b) =>
      b.data.updated.localeCompare(a.data.updated) || a.data.title.localeCompare(b.data.title),
  );
}
