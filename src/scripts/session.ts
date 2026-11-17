// Why this exists: pages are static, so the browser works out who is signed
// in. The signed_in cookie (not secret) says whether to ask /api/me at all.
// Once per browser session it also merges this browser's progress with the
// account's, and after that it sends each new solve as it happens.
import type { Me } from "../pages/api/me.ts";
import { syncDaily } from "./daily-sync.ts";
import {
  mergeProgress,
  PROGRESS_EVENT,
  type Progress,
  readProgress,
  STORAGE_KEY,
} from "./progress.ts";
import { trackOnce } from "./track.ts";

const SYNCED_KEY = "formula-practice:synced";
const DAILY_SYNCED_KEY = "formula-practice:daily-synced";
/** Fired on document when progress from the account has been merged into this browser. */
export const SYNCED_EVENT = "formula-practice:synced";

export const signedIn = (): boolean => /(?:^|;\s*)signed_in=1(?:;|$)/u.test(document.cookie);

let mePromise: Promise<Me | null> | null = null;
/** The signed-in user, or null. Asks the server once per page. */
export function loadMe(): Promise<Me | null> {
  mePromise ??= signedIn()
    ? fetch("/api/me/", { credentials: "same-origin" })
        .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
        .catch(() => null)
    : Promise.resolve(null);
  return mePromise;
}

function showState(isIn: boolean): void {
  for (const el of document.querySelectorAll<HTMLElement>("[data-when]")) {
    el.hidden = el.dataset["when"] !== (isIn ? "in" : "out");
  }
}

function putProgress(progress: Progress): Promise<Response> {
  return fetch("/api/progress/", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(progress),
  });
}

async function syncOnce(): Promise<void> {
  try {
    if (sessionStorage.getItem(SYNCED_KEY)) return;
    const res = await fetch("/api/progress/", { credentials: "same-origin" });
    if (!res.ok) return;
    const merged = mergeProgress(readProgress(), (await res.json()) as Progress);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    document.dispatchEvent(new Event(SYNCED_EVENT));
    if ((await putProgress(merged)).ok) sessionStorage.setItem(SYNCED_KEY, "1");
  } catch {
    // Offline or storage blocked: progress stays in this browser and syncs next time.
  }
}

// The daily streak too: once per browser session, from whatever page comes
// first after sign-in, so days solved signed out reach the account. A page
// that shows the streak (daily, account) joins again on its own.
async function syncDailyOnce(): Promise<void> {
  try {
    if (sessionStorage.getItem(DAILY_SYNCED_KEY)) return;
    if ((await syncDaily()).joined) sessionStorage.setItem(DAILY_SYNCED_KEY, "1");
  } catch {
    // Storage blocked: the next page tries again.
  }
}

// One visit per tab: the start of the funnel /api/events counts.
trackOnce("visit", "session");

// The cookie answers at once, so the header does not flash the wrong buttons.
showState(signedIn());
if (signedIn()) {
  void loadMe().then((me) => {
    showState(me !== null);
    if (!me) return;
    for (const el of document.querySelectorAll<HTMLElement>("[data-me-email]"))
      el.textContent = me.email;
    void syncOnce();
    void syncDailyOnce();
  });
  document.addEventListener(PROGRESS_EVENT, (e) => {
    const { id, entry } = (e as CustomEvent).detail as { id: string; entry: Progress[string] };
    void putProgress({ [id]: entry }).catch(() => undefined);
  });
} else {
  try {
    sessionStorage.removeItem(SYNCED_KEY);
    sessionStorage.removeItem(DAILY_SYNCED_KEY);
  } catch {
    // Storage blocked: nothing to clear.
  }
}
