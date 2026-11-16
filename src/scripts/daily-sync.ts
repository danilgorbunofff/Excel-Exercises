// Why this exists: the one place this browser's daily streak meets the
// account's. Signed in, it reads the account's days, joins them with this
// browser's (mergeDaily), keeps the result here and sends the account the
// days it lacks. The server only inserts, so nothing is ever overwritten.
import { type DailySolve, mergeDaily } from "../lib/daily.ts";
import { type DailyDays, readDaily, writeDaily } from "./daily-store.ts";
import { loadMe, signedIn } from "./session.ts";

/** Fired on document once the account's days are in this browser. */
export const DAILY_SYNCED_EVENT = "formula-practice:daily-synced";

export interface DailySync {
  days: DailyDays;
  /** Days the account has (or has been sent), so none is sent twice. */
  server: Set<string>;
  /** True once the account's days were read and joined. */
  joined: boolean;
}

/** Sends solved days to the account. A failure leaves them in this browser. */
export function postDaily(solves: DailySolve[], sync: DailySync): Promise<unknown> {
  for (const s of solves) sync.server.add(s.day);
  return fetch("/api/daily/", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(solves),
  }).catch(() => undefined);
}

async function run(): Promise<DailySync> {
  const local: DailySync = { days: readDaily(), server: new Set(), joined: false };
  if (!signedIn() || !(await loadMe())) return local;
  try {
    const res = await fetch("/api/daily/", { credentials: "same-origin" });
    if (!res.ok) return local;
    const rows = (await res.json()) as DailySolve[];
    const { days, missing } = mergeDaily(readDaily(), rows);
    const sync: DailySync = { days, server: new Set(rows.map((r) => r.day)), joined: true };
    writeDaily(days);
    document.dispatchEvent(new Event(DAILY_SYNCED_EVENT));
    if (missing.length > 0) void postDaily(missing, sync);
    return sync;
  } catch {
    // Offline: the streak stays in this browser and is joined next time.
    return local;
  }
}

let once: Promise<DailySync> | null = null;
/** This browser's days, joined with the account's when signed in. Once per page. */
export function syncDaily(): Promise<DailySync> {
  once ??= run();
  return once;
}
