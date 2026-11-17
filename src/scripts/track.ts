// Why this exists: sends one anonymous usage event to this site's own
// /api/events. The tab id is random and kept only for this tab, and the
// request carries no cookies.
import type { EventName } from "../lib/events.ts";

const TAB_KEY = "formula-practice:tab";
const ONCE_KEY = "formula-practice:once:";

function tabId(): string | undefined {
  try {
    let id = sessionStorage.getItem(TAB_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(TAB_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

export function track(name: EventName): void {
  try {
    void fetch("/api/events/", {
      method: "POST",
      credentials: "omit",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, path: location.pathname, tab: tabId() }),
    }).catch(() => undefined);
  } catch {
    // No fetch: nothing is counted.
  }
}

/** Sends the event only the first time in this browser ("local") or tab ("session"). */
export function trackOnce(name: EventName, scope: "local" | "session" = "local"): void {
  try {
    const store = scope === "local" ? localStorage : sessionStorage;
    if (store.getItem(ONCE_KEY + name)) return;
    store.setItem(ONCE_KEY + name, "1");
  } catch {
    return;
  }
  track(name);
}
