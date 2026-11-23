// Why this exists: fills the account Daily page: today's status, the streak
// numbers, the month calendar and the last two weeks, from this browser's daily
// days joined with the account's (syncDaily).
import {
  bestStreak,
  currentStreak,
  type DailyEntry,
  LADDER_START,
  pickFor,
  TIER_NAMES,
  tierOf,
} from "../lib/daily.ts";
import type { DailyDays } from "./daily-store.ts";
import { syncDaily } from "./daily-sync.ts";
import { renderMonth } from "./daily-view.ts";
import { addDays, localDay } from "./progress.ts";

interface Data {
  pool: DailyEntry[];
  titles: Record<string, string>;
}
const node = document.querySelector("script[data-daily-data]");
const data: Data = node?.textContent ? JSON.parse(node.textContent) : { pool: [], titles: {} };
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);
const text = (s: string, v: string) => {
  const el = $(s);
  if (el) el.textContent = v;
};
const weekday = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });

function paint(days: DailyDays): void {
  const today = localDay();
  const set = new Set(Object.keys(days));
  const pick = pickFor(today, data.pool);
  const solved = days[today] !== undefined;

  const state = $("[data-today-state]");
  if (state) {
    state.textContent = solved ? "Solved today" : "Not solved yet";
    state.className = solved ? "pill ok" : "pill";
  }
  const title = data.titles[days[today] ?? pick?.id ?? ""];
  if (title) text("[data-today-title]", title);
  text(
    "[data-today-step]",
    `${weekday(today)}, ${TIER_NAMES[tierOf(today)]?.toLowerCase()} step of the week`,
  );
  const button = $("[data-today-button]");
  if (button && solved) button.className = "button button-secondary";

  const month = today.slice(0, 7);
  text("[data-fig=streak]", String(currentStreak(set, today)));
  text("[data-fig=best]", String(bestStreak(set)));
  text("[data-fig=month]", String([...set].filter((d) => d.startsWith(month)).length));
  text("[data-fig=month-of]", `of ${Number(today.slice(8))} days`);
  text("[data-fig=tomorrow]", TIER_NAMES[tierOf(addDays(today, 1))] ?? "");

  const cal = $("[data-daily-cal]");
  if (cal)
    renderMonth(cal, days, month, today, (day) => {
      const id = days[day] ?? pickFor(day, data.pool)?.id;
      return id ? data.titles[id] : undefined;
    });

  const rows = Array.from({ length: 14 }, (_, i) => addDays(today, -i)).map((day) => {
    const done = days[day] !== undefined;
    const id = days[day] ?? pickFor(day, data.pool)?.id;
    const tr = document.createElement("tr");
    const when = new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    const cells = [
      Object.assign(document.createElement("td"), { className: "tnum nowrap", textContent: when }),
      Object.assign(document.createElement("td"), {
        className: done ? "" : "muted",
        textContent: (id && data.titles[id]) || "Daily exercise",
      }),
      Object.assign(document.createElement("td"), {
        className: "muted nowrap",
        textContent: day >= LADDER_START ? `${tierOf(day)} of 7` : "Mixed",
      }),
    ];
    const result = document.createElement("td");
    result.append(
      Object.assign(document.createElement("span"), {
        className: done ? "pill ok" : "pill",
        textContent: done ? "Solved" : day === today ? "Not yet" : "Not solved",
      }),
    );
    tr.append(...cells, result);
    return tr;
  });
  $("[data-days]")?.replaceChildren(...rows);
}

void syncDaily().then(({ days }) => paint(days));
