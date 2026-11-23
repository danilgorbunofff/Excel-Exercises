// Why this exists: marks progress in every exercise table and on track cards,
// and runs the catalogue's filter panel and sortable columns. A search from
// elsewhere arrives as ?q=, and a function link as ?fn=. Without this script every exercise is listed in
// track order.
import {
  type CatalogueFilter,
  type CatalogueRow,
  compare,
  countLine,
  matches,
  type SortDir,
  type SortKey,
} from "../lib/catalogue.ts";
import { collapse } from "./collapse.ts";
import { readProgress } from "./progress.ts";
import { paintStatus } from "./status.ts";

const progress = readProgress();
paintStatus(progress);

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
  const field = (name: string) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
  const params = new URLSearchParams(location.search);
  for (const name of ["q", "fn", "level", "track", "progress"]) {
    const el = field(name);
    const v = params.get(name);
    if (el && v !== null) el.value = v;
  }
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
  form.addEventListener("reset", () => setTimeout(apply));
  // Sorting re-orders the rows, so the cap is worked out again.
  table.addEventListener("sorted", apply);
  apply();
}

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
