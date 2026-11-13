// Why this exists: finds the formula walkthroughs that use one function, so a
// function page can link to them. Pure, so it is unit-tested.

interface WalkthroughLike {
  formula: string;
}

/** The walkthroughs whose formula calls the function. SUM does not match SUMIFS. */
export function walkthroughsFor<T extends WalkthroughLike>(name: string, all: readonly T[]): T[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const call = new RegExp(`(?<![A-Za-z0-9_.])${escaped}\\(`, "iu");
  return all.filter((w) => call.test(w.formula));
}
