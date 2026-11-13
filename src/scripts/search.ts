// Why this exists: suggestions under the header search box. The index is a
// small JSON file fetched on first focus. Arrow keys move, Enter opens,
// Escape closes. Without this script the box is a plain form.
import { type SearchItem, search } from "../lib/search.ts";

let index: Promise<SearchItem[]> | null = null;
const load = () => {
  index ??= fetch("/search-index.json")
    .then((r) => (r.ok ? (r.json() as Promise<SearchItem[]>) : []))
    .catch(() => []);
  return index;
};

for (const form of document.querySelectorAll<HTMLFormElement>("[data-search]")) {
  const input = form.querySelector<HTMLInputElement>("[data-search-input]");
  const list = form.querySelector<HTMLUListElement>("[data-search-list]");
  if (!input || !list) continue;
  let active = -1;
  let results: SearchItem[] = [];

  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  };
  const highlight = (i: number) => {
    const options = [...list.querySelectorAll<HTMLLIElement>("[role=option]")];
    active = options.length ? (i + options.length) % options.length : -1;
    options.forEach((o, n) => {
      o.setAttribute("aria-selected", String(n === active));
    });
    const current = options[active];
    if (current) input.setAttribute("aria-activedescendant", current.id);
    else input.removeAttribute("aria-activedescendant");
  };
  const render = async () => {
    const q = input.value.trim();
    if (!q) return close();
    results = search(await load(), q, 6);
    list.replaceChildren();
    if (!results.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No matches. Press Enter to search everything.";
      list.append(li);
    }
    results.forEach((r, i) => {
      const li = document.createElement("li");
      li.id = `${list.id}-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      const a = document.createElement("a");
      a.href = r.url;
      a.tabIndex = -1;
      const title = document.createElement("span");
      title.textContent = r.title;
      const kind = document.createElement("span");
      kind.className = "kind";
      kind.textContent = r.kind;
      a.append(title, kind);
      li.append(a);
      list.append(li);
    });
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    active = -1;
  };

  input.addEventListener("focus", () => void load(), { once: true });
  input.addEventListener("input", () => void render());
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (list.hidden) return;
      e.preventDefault();
      highlight(active + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter") {
      const chosen = results[active];
      if (active < 0 || !chosen) return;
      e.preventDefault();
      location.assign(chosen.url);
    }
  });
  form.addEventListener("focusout", (e) => {
    if (!form.contains(e.relatedTarget as Node | null)) close();
  });
}
