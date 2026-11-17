// Why this exists: writes one usage event. Counting must never break the
// request it rides on, so every failure is swallowed.
import type { EventName } from "../lib/events.ts";
import { adminClient } from "./supabase.ts";

export async function logEvent(
  name: EventName,
  path: string | null = null,
  tab: string | null = null,
): Promise<void> {
  try {
    await adminClient().from("events").insert({ name, path, tab });
  } catch {
    // Not configured or the database is down: the event is lost, nothing else.
  }
}
