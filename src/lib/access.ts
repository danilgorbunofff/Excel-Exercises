// Why this exists: the one rule for which exercises need PRO. Pages, the
// catalogue and the exercise data endpoint all ask here, so they cannot
// disagree about what is locked.
import { siteConfig } from "../../site.config.ts";

/** True when the exercise needs PRO: it is marked pro, or it comes after the free ones. */
export function isLocked(
  placed: { exercise: { pro: boolean }; number: number },
  freeCount: number | null = siteConfig.freeCount,
): boolean {
  return placed.exercise.pro || (freeCount !== null && placed.number > freeCount);
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
