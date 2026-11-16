// Why this exists: a returning visitor with a daily streak sees it on the home
// page, as one quiet line. Nothing shows at zero. The days come from this
// browser; signed in, session.ts joins them with the account's first.
import { currentStreak } from "../lib/daily.ts";
import { readDaily } from "./daily-store.ts";
import { DAILY_SYNCED_EVENT } from "./daily-sync.ts";
import { dayCount } from "./daily-view.ts";
import { localDay } from "./progress.ts";

const line = document.querySelector<HTMLElement>("[data-home-streak]");

function show() {
  if (!line) return;
  const n = currentStreak(new Set(Object.keys(readDaily())), localDay());
  line.textContent = n > 0 ? `Your streak: ${dayCount(n)}.` : "";
  line.hidden = n === 0;
}

show();
document.addEventListener(DAILY_SYNCED_EVENT, show);
