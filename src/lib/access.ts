// Why this exists: the one rule for which exercises need PRO. Pages, the
// catalogue and the exercise data endpoint all ask here, so they cannot
// disagree about what is locked.
import { siteConfig } from "../../site.config.ts";

/** True when the exercise needs PRO: it comes after the free ones at the start of its track. */
export function isLocked(
  placed: { topicNumber: number },
  freePerTrack: number = siteConfig.freePerTrack,
): boolean {
  return placed.topicNumber > freePerTrack;
}

/**
 * Each exercise's position in its track, from the track order. For code that
 * reads the content files directly (the validator, the end-to-end tests).
 */
export function topicNumbers(
  order: readonly string[],
  topicOf: (id: string) => string,
): Map<string, number> {
  const seen = new Map<string, number>();
  return new Map(
    order.map((id) => {
      const n = (seen.get(topicOf(id)) ?? 0) + 1;
      seen.set(topicOf(id), n);
      return [id, n];
    }),
  );
}

/** Lifetime PRO: one payment, no end date. */
export const LIFETIME = "lifetime";
/** Statuses that give PRO: a Stripe subscription's, or lifetime. */
export const ACTIVE_STATUSES = ["active", "trialing", "past_due", LIFETIME] as const;

/** True when a profile row gives PRO right now. */
export function hasPro(
  profile: { pro_status: string | null; pro_until: string | null } | null,
  now = new Date(),
): boolean {
  if (
    !profile?.pro_status ||
    !(ACTIVE_STATUSES as readonly string[]).includes(profile.pro_status)
  ) {
    return false;
  }
  return profile.pro_until === null || new Date(profile.pro_until) > now;
}
