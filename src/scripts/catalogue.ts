// Why this exists: marks progress in every exercise table and on track cards,
// paints the catalogue's own numbers (solved, day streak, tracks done), points
// the start card at the next unsolved exercise and replays its formula, and
// runs the filter panel and sortable columns. A search from
// elsewhere arrives as ?q=, and a function link as ?fn=. Without this script every exercise is listed in
// track order.
import {
  type CatalogueFilter,
  type CatalogueRow,
  compare,
  countLine,
  isDone,
  matches,
  type SortDir,
  type SortKey,
} from "../lib/catalogue.ts";
import { currentStreak } from "../lib/daily.ts";
import { collapse } from "./collapse.ts";
import { readDaily } from "./daily-store.ts";
import { activeDays, foldSets, localDay, readProgress } from "./progress.ts";
import { SYNCED_EVENT } from "./session.ts";
import { paintStatus } from "./status.ts";

function paintStats(): void {
  const stats = document.querySelector<HTMLElement>("[data-stats]");
  if (!stats) return;
  // Whether each track still has an exercise to solve.
  const tracks = new Map<string, boolean>();
  let solved = 0;
  for (const row of document.querySelectorAll<HTMLElement>("[data-row]")) {
    const done = isDone(row.dataset["state"] ?? "");
    if (done) solved += 1;
    const track = row.dataset["track"] ?? "";
    tracks.set(track, (tracks.get(track) ?? true) && done);
  }
  const done = [...tracks.values()].filter(Boolean).length;
  // Any day of practice counts, the daily exercise included, as on the progress page.
  const days = activeDays(readProgress(), Object.keys(readDaily()));
  const write = (selector: string, value: string | number) => {
    const el = stats.querySelector(selector);
    if (el) el.textContent = String(value);
  };
  write("[data-stat-solved]", solved);
  write("[data-stat-streak]", currentStreak(new Set(days.keys()), localDay()));
  write("[data-stat-tracks]", done);
  write("[data-stat-tracks-word]", done === 1 ? "track" : "tracks");
  stats.classList.add("ready");
}

/** The start card's link: the first unsolved exercise in track order. */
function paintStart(): void {
  const link = document.querySelector<HTMLAnchorElement>("[data-start-link]");
  const label = link?.querySelector("[data-start-label]");
  if (!link || !label) return;
  const rows = [...document.querySelectorAll<HTMLElement>("[data-row]")].sort(
    (a, b) => Number(a.dataset["order"]) - Number(b.dataset["order"]),
  );
  const open = rows.filter((row) => !isDone(row.dataset["state"] ?? ""));
  const href = (open[0] ?? rows[0])?.querySelector("th a")?.getAttribute("href");
  if (href) link.setAttribute("href", href);
  if (!open.length) label.textContent = "Practise again";
  else if (open.length < rows.length) label.textContent = "Continue practising";
  else label.textContent = "Start the first task";
}

/** Types the start card's formula, then lights the answer; again on each hover. */
function playSheet(): void {
  const card = document.querySelector<HTMLElement>("[data-start-sheet]");
  const typed = card?.querySelector<HTMLElement>("[data-typed]");
  const result = card?.querySelector<HTMLElement>("[data-sheet-result]");
  if (!card || !typed || !result) return;
  if (!matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
  const formula = typed.textContent ?? "";
  const answer = result.textContent ?? "";
  const play = () => {
    result.textContent = "";
    result.classList.remove("lit");
    let length = 0;
    const type = () => {
      typed.textContent = formula.slice(0, length);
      if (length++ < formula.length) setTimeout(type, 110);
      else
        setTimeout(() => {
          result.textContent = answer;
          result.classList.add("lit");
        }, 250);
    };
    type();
  };
  play();
  // Not while it is still typing, so two runs never overlap.
  card.addEventListener("mouseenter", () => {
    if (result.classList.contains("lit")) play();
  });
}

function paint(): void {
  // By exercise: a solved ladder step counts as its exercise solved.
  paintStatus(foldSets(readProgress()));
  paintStats();
  paintStart();
}
paint();
playSheet();

const rowOf = (el: HTMLElement): CatalogueRow => ({
  order: Number(el.dataset["order"]),
  title: el.dataset["title"] ?? "",
  level: Number(el.dataset["level"]),
  track: el.dataset["track"] ?? "",
  search: el.dataset["search"] ?? "",
  functions: (el.dataset["functions"] ?? "").split(" ").filter(Boolean),
  state: el.dataset["state"] ?? "",
});

const form = document.querySelector<HTMLFormElement>("[data-filter]");
const table = document.querySelector<HTMLTableElement>("[data-exercise-table]");
const count = document.querySelector<HTMLElement>("[data-filter-count]");
const tbody = table?.tBodies[0];

if (form && table && tbody) {
  form.classList.add("ready");
  const rows = [...tbody.querySelectorAll<HTMLElement>("[data-row]")];
  // Table order, so a sorted table keeps its first 20.
  const cap = collapse(
    table.closest(".table-wrap") ?? table,
    () => [...tbody.querySelectorAll<HTMLElement>("[data-row]")],
    20,
    "exercises",
  );
  // A text box, or a group of radios: both read and take a value.
  const field = (name: string) => form.elements.namedItem(name) as { value: string } | null;
  const params = new URLSearchParams(location.search);
  for (const name of ["q", "fn", "level", "track", "progress"]) {
    const el = field(name);
    const v = params.get(name);
    if (el && v !== null) el.value = v;
  }
  const picks = [...form.querySelectorAll<HTMLDetailsElement>("[data-pick]")];
  // The chosen difficulty tile: pressing it again clears it.
  let level = "";
  const apply = () => {
    const f: CatalogueFilter = {
      q: field("q")?.value ?? "",
      fn: field("fn")?.value ?? "",
      level: field("level")?.value ?? "",
      track: field("track")?.value ?? "",
      progress: (field("progress")?.value ?? "") as CatalogueFilter["progress"],
    };
    let shown = 0;
    for (const el of rows) {
      el.hidden = !matches(rowOf(el), f);
      if (!el.hidden) shown += 1;
    }
    const filtered = Boolean(f.q.trim() || f.fn || f.level || f.track || f.progress);
    cap(filtered);
    level = f.level ?? "";
    for (const pick of picks) {
      const chosen = pick.querySelector<HTMLInputElement>("input[type=radio]:checked");
      const name = chosen?.value
        ? chosen.parentElement?.querySelector("[data-pick-label]")?.textContent
        : pick.dataset["all"];
      const out = pick.querySelector("[data-pick-value]");
      if (out) out.textContent = name ?? "";
    }
    const meter = form.querySelector<HTMLElement>("[data-filter-meter]");
    if (meter) meter.style.width = `${(shown / rows.length) * 100}%`;
    const line = countLine(shown, rows.length, filtered);
    if (count) {
      // The number leads in bold: "18 of 128 exercises".
      const m = /^(\d+)(.*)$/.exec(line || `${rows.length} exercises`);
      if (m)
        count.replaceChildren(
          Object.assign(document.createElement("b"), { textContent: m[1] }),
          m[2] ?? "",
        );
      else count.textContent = line;
    }
    const total = document.querySelector<HTMLElement>("[data-filter-total]");
    if (total) total.textContent = String(shown);
    // The folded lists say on their button how many of them are set.
    const set = [f.fn, f.level, f.track, f.progress].filter(Boolean).length;
    if (moreLabel) moreLabel.textContent = set ? `More filters (${set})` : "More filters";
    const active = set + (f.q.trim() ? 1 : 0);
    if (activeTag) {
      activeTag.hidden = active === 0;
      activeTag.textContent = `${active} active`;
    }
    if (resetButton) resetButton.hidden = active === 0;
  };
  const activeTag = form.querySelector<HTMLElement>("[data-filter-active]");
  const resetButton = form.querySelector<HTMLElement>("[data-filter-reset]");
  const more = form.querySelector<HTMLButtonElement>("[data-more-toggle]");
  const moreLabel = more?.querySelector("[data-more-label]");
  more?.addEventListener("click", () => {
    const open = form.classList.toggle("open");
    more.setAttribute("aria-expanded", String(open));
  });
  // A link that arrives with ?fn= or ?track= opens the lists, so the set
  // filter is in view.
  if (["fn", "level", "track", "progress"].some((n) => params.get(n))) more?.click();
  form.addEventListener("input", apply);
  form.addEventListener("change", apply);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    apply();
  });
  form.addEventListener("reset", () => {
    for (const pick of picks) pick.open = false;
    setTimeout(apply);
  });
  const narrow = (pick: HTMLElement, query: string) => {
    for (const item of pick.querySelectorAll<HTMLElement>("li")) {
      const name = item.querySelector("[data-pick-label]")?.textContent?.toLowerCase() ?? "";
      item.hidden = !name.includes(query.trim().toLowerCase());
    }
  };
  const shut = (pick: HTMLDetailsElement) => {
    pick.open = false;
    pick.querySelector("summary")?.focus();
  };
  for (const pick of picks) {
    const search = pick.querySelector<HTMLInputElement>("[data-pick-search]");
    search?.addEventListener("input", () => narrow(pick, search.value));
    pick.addEventListener("toggle", () => {
      if (!pick.open || !search) return;
      search.value = "";
      narrow(pick, "");
      // Not on touch screens, where focus would open the keyboard over the list.
      if (matchMedia("(hover: hover)").matches) search.focus();
    });
    // Tabbing out closes it. A press on an item moves focus nowhere (null).
    pick.addEventListener("focusout", (e) => {
      if (e.relatedTarget instanceof Node && !pick.contains(e.relatedTarget)) pick.open = false;
    });
    pick.addEventListener("keydown", (e) => {
      if (pick.open && (e.key === "Escape" || e.key === "Enter")) {
        // Enter on the summary opens and closes by itself.
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "SUMMARY") return;
        e.preventDefault();
        shut(pick);
      }
    });
    // A press on an item picks it and closes; arrow keys keep the list open.
    pick.querySelector("ul")?.addEventListener("click", (e) => {
      // A pointer lands on the label's text; the keyboard clicks the radio itself.
      if (!(e.target instanceof HTMLInputElement)) setTimeout(() => shut(pick));
    });
  }
  document.addEventListener("click", (e) => {
    for (const pick of picks) if (!pick.contains(e.target as Node)) pick.open = false;
  });
  form.addEventListener("click", (e) => {
    const tile = e.target;
    if (tile instanceof HTMLInputElement && tile.name === "level" && tile.value === level) {
      tile.checked = false;
      apply();
    }
  });
  // Sorting re-orders the rows, so the cap is worked out again.
  table.addEventListener("sorted", apply);
  apply();
}
// Signed in, the account's progress arrives after load: repaint, then filter
// again, as the Progress filter reads each row's state.
document.addEventListener(SYNCED_EVENT, () => {
  paint();
  form?.dispatchEvent(new Event("change"));
});

if (table && tbody) {
  const rows = [...tbody.querySelectorAll<HTMLElement>("[data-row]")];
  const headers = [...table.querySelectorAll<HTMLTableCellElement>("th[data-sort-key]")];
  let key: SortKey = "order";
  let dir: SortDir = "ascending";
  const sort = () => {
    const sorted = [...rows].sort((a, b) => compare(rowOf(a), rowOf(b), key, dir));
    tbody.append(...sorted);
    table.dispatchEvent(new Event("sorted"));
    for (const th of headers) {
      if (th.dataset["sortKey"] === key && key !== "order") th.setAttribute("aria-sort", dir);
      else th.removeAttribute("aria-sort");
    }
  };
  for (const th of headers) {
    th.querySelector("button")?.addEventListener("click", () => {
      const k = th.dataset["sortKey"] as SortKey;
      if (k === key) {
        // Third click goes back to the track order.
        if (dir === "descending") {
          key = "order";
          dir = "ascending";
        } else dir = "descending";
      } else {
        key = k;
        dir = "ascending";
      }
      sort();
    });
  }
}
