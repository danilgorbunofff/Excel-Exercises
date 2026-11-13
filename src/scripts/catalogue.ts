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

if (form && tbody) {
  form.classList.add("ready");
  const rows = [...tbody.querySelectorAll<HTMLElement>("[data-row]")];
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
    const line = countLine(shown, rows.length, filtered);
    if (count) count.textContent = line || `${rows.length} exercises`;
    const total = document.querySelector<HTMLElement>("[data-filter-total]");
    if (total) total.textContent = String(shown);
  };
  form.addEventListener("input", apply);
  form.addEventListener("change", apply);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    apply();
  });
  form.addEventListener("reset", () => setTimeout(apply));
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
