// Why this exists: draws the daily streak wherever it shows: the numbers and
// the strip of recent days on /daily/ and on the account page. The streak
// itself is counted in lib/daily.ts; this only puts it on the page.
import { bestStreak, currentStreak, DAILY_START, stripDays } from "../lib/daily.ts";
import type { DailyDays } from "./daily-store.ts";
import { localDay } from "./progress.ts";

/** "Sunday 15 November", read in UTC so the day never shifts. */
export const longDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
const weekdayLetter = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" });
export const dayCount = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/**
 * Fills [data-current], [data-best] and [data-strip] inside root from the
 * solved days. shown: the day /daily/ is showing, marked in the strip.
 */
export function renderStreak(root: Element, days: DailyDays, shown?: string): void {
  const set = new Set(Object.keys(days));
  const now = localDay();
  const current = root.querySelector("[data-current]");
  if (current) current.textContent = dayCount(currentStreak(set, now));
  const best = root.querySelector("[data-best]");
  if (best) best.textContent = dayCount(bestStreak(set));
  const strip = root.querySelector("[data-strip]");
  const icon = root.querySelector<HTMLTemplateElement>("template[data-check-icon]");
  if (!strip) return;
  strip.replaceChildren(
    ...stripDays(set, now).map((d) => {
      const li = document.createElement("li");
      li.className = "d-day";
      li.classList.toggle("is-solved", d.solved);
      li.classList.toggle("is-today", d.today);
      const head = document.createElement("span");
      head.className = "d-head";
      head.setAttribute("aria-hidden", "true");
      head.textContent = weekdayLetter(d.day);
      const label = `${longDate(d.day)}${d.today ? ", today" : ""}, ${d.solved ? "solved" : "not solved"}`;
      const playable = d.day >= DAILY_START;
      const cell = document.createElement(playable ? "a" : "span");
      cell.className = "d-cell";
      if (cell instanceof HTMLAnchorElement) {
        cell.href = d.today ? "/daily/" : `/daily/?day=${d.day}`;
        if (d.day === shown) cell.setAttribute("aria-current", "page");
      }
      const text = document.createElement("span");
      text.className = "visually-hidden";
      text.textContent = label;
      const num = document.createElement("span");
      num.className = "d-num";
      num.setAttribute("aria-hidden", "true");
      num.textContent = String(Number(d.day.slice(8)));
      cell.append(text, num);
      if (d.solved && icon) cell.append(icon.content.cloneNode(true));
      li.append(head, cell);
      return li;
    }),
  );
}
