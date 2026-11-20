// Why this exists: the one list of usage events the site counts. The browser
// and the server both send only these names, and /api/events refuses others.

export const EVENT_NAMES = [
  "visit",
  "first_check",
  "first_solve",
  "solve_3",
  "daily_done",
  "mock_start",
  "mock_finish",
  "paywall_seen",
  "drill_start",
  "drill_finish",
  "drill_free_run",
  "checkout_start",
  "pro_active",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

const TAB = /^[\w-]{8,40}$/u;
const MAX_PATH = 200;

export interface CleanEvent {
  name: EventName;
  path: string | null;
  tab: string | null;
}

/** Checks an event the browser sent. Anything unexpected gives null. */
export function cleanEvent(body: unknown): CleanEvent | null {
  if (!body || typeof body !== "object") return null;
  const { name, path, tab } = body as Record<string, unknown>;
  if (typeof name !== "string" || !(EVENT_NAMES as readonly string[]).includes(name)) return null;
  if (path !== undefined && (typeof path !== "string" || !/^\/(?!\/)/u.test(path))) return null;
  if (tab !== undefined && (typeof tab !== "string" || !TAB.test(tab))) return null;
  return {
    name: name as EventName,
    // Only the path: a query string can hold an email or a token.
    path: typeof path === "string" ? (path.split(/[?#]/u)[0] ?? "").slice(0, MAX_PATH) : null,
    tab: typeof tab === "string" ? tab : null,
  };
}
