// Why this exists: picks the articles to offer after one is read. Those that
// cover the same functions come first. Pure, so it is unit-tested.

interface ArticleLike {
  id: string;
  data: { functions: readonly string[] };
}

export function relatedArticles<T extends ArticleLike>(
  all: readonly T[],
  currentId: string,
  limit = 3,
): T[] {
  const current = all.find((a) => a.id === currentId);
  const mine = new Set(current?.data.functions ?? []);
  const shared = (a: T) => a.data.functions.filter((f) => mine.has(f)).length;
  return all
    .filter((a) => a.id !== currentId)
    .map((a, i) => ({ a, i, n: shared(a) }))
    .sort((x, y) => y.n - x.n || x.i - y.i)
    .slice(0, limit)
    .map((x) => x.a);
}
