// Why this exists: draws the daily streak wherever it shows: the numbers and
// the month calendar on /daily/, and the strip of recent days on the account
// page. The streak itself is counted in lib/daily.ts; this only puts it on
// the page.
import {
  bestStreak,
  currentStreak,
  LADDER_START,
  stripDays,
  TIER_NAMES,
  tierOf,
} from "../lib/daily.ts";
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
const weekdayName = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" });
export const dayCount = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** One day as a cell: a link once it can be played, with its full name for screen readers. */
function dayCell(
  d: { day: string; solved: boolean; today: boolean; future: boolean },
  shown: string | undefined,
  icon: HTMLTemplateElement | null,
): HTMLElement {
  const tier = d.day >= LADDER_START ? TIER_NAMES[tierOf(d.day)] : "";
  const step = tier ? `, ${tier.toLowerCase()}` : "";
  const state = d.future ? "to come" : d.solved ? "solved" : "not solved";
  const playable = d.day >= LADDER_START && !d.future;
  const cell = document.createElement(playable ? "a" : "span");
  cell.className = "d-cell";
  if (cell instanceof HTMLAnchorElement) {
    cell.href = d.today ? "/daily/" : `/daily/?day=${d.day}`;
    if (d.day === shown) cell.setAttribute("aria-current", "page");
  }
  const text = document.createElement("span");
  text.className = "visually-hidden";
  text.textContent = `${longDate(d.day)}${d.today ? ", today" : ""}${step}, ${state}`;
  const num = document.createElement("span");
  num.className = "d-num";
  num.setAttribute("aria-hidden", "true");
  num.textContent = String(Number(d.day.slice(8)));
  cell.append(text, num);
  if (d.solved && icon) cell.append(icon.content.cloneNode(true));
  return cell;
}

const dayItem = (d: { solved: boolean; today: boolean; future: boolean }) => {
  const li = document.createElement("li");
  li.className = "d-day";
  li.classList.toggle("is-solved", d.solved);
  li.classList.toggle("is-today", d.today);
  li.classList.toggle("is-future", d.future);
  return li;
};

/**
 * Fills [data-current], [data-best] and the [data-strip] of the last days
 * inside root from the solved days.
 */
export function renderStreak(root: Element, days: DailyDays): void {
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
      const li = dayItem({ ...d, future: false });
      const head = document.createElement("span");
      head.className = "d-head";
      head.setAttribute("aria-hidden", "true");
      head.textContent = weekdayName(d.day);
      li.append(head, dayCell({ ...d, future: false }, undefined, icon));
      return li;
    }),
  );
}

/**
 * Fills the [data-month] calendar for month ("2026-11"), Monday first, with
 * its title and the count of days solved in it. shown: the day /daily/ is
 * showing, marked in the calendar.
 */
export function renderMonth(root: Element, days: DailyDays, month: string, shown: string): void {
  const now = localDay();
  const grid = root.querySelector("[data-month]");
  const icon = root.querySelector<HTMLTemplateElement>("template[data-check-icon]");
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const list = Array.from({ length }, (_, i) => {
    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { day, solved: days[day] !== undefined, today: day === now, future: day > now };
  });
  const title = root.querySelector("[data-month-title]");
  if (title)
    title.textContent = new Date(Date.UTC(year, mon - 1)).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const solved = root.querySelector("[data-month-solved]");
  if (solved) solved.textContent = String(list.filter((d) => d.solved).length);
  grid?.replaceChildren(
    ...list.map((d, i) => {
      const li = dayItem(d);
      // The first day sits under its weekday; the rest flow after it.
      if (i === 0) li.style.gridColumnStart = String(tierOf(d.day));
      li.append(dayCell(d, shown, icon));
      return li;
    }),
  );
}
