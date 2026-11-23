// Why this exists: the large search window. It filters the same index as the
// header suggestions, groups the matches by kind and lets a filter chip
// narrow them to one kind. Arrow keys move, Enter opens, Escape closes.
// Ctrl K opens it from anywhere; "/" focuses the header search box.
import { type SearchItem, type SearchKind, search } from "../lib/search.ts";
import { loadIndex } from "./search-index.ts";

const GROUPS: readonly [SearchKind, string][] = [
  ["Function", "Functions"],
  ["Exercise", "Exercises"],
  ["Track", "Learning tracks"],
  ["Article", "Articles"],
  ["Page", "Pages"],
];
const dialog = document.querySelector<HTMLDialogElement>("[data-search-dialog]");
const input = dialog?.querySelector<HTMLInputElement>("[data-dialog-input]");
const box = dialog?.querySelector<HTMLElement>("[data-dialog-results]");
const all = dialog?.querySelector<HTMLAnchorElement>("[data-dialog-all]");
const chips = [...(dialog?.querySelectorAll<HTMLButtonElement>("[data-scope]") ?? [])];
const expand = document.querySelector<HTMLButtonElement>("[data-search-expand]");
const pill = document.querySelector<HTMLInputElement>("#site-search");

/** Visible means the wide header is showing; phones use the Menu dialog. */
const shown = (el: HTMLElement | null | undefined) => !!el && el.offsetParent !== null;

if (dialog && input && box && all) {
  let scope = "";
  let active = -1;
  const options = () => [...box.querySelectorAll<HTMLAnchorElement>("a[role=option]")];
  const note = (text: string) => {
    const p = document.createElement("p");
    p.className = "blank";
    p.textContent = text;
    box.replaceChildren(p);
  };
  const highlight = (i: number) => {
    const list = options();
    active = list.length ? (i + list.length) % list.length : -1;
    list.forEach((o, n) => {
      o.setAttribute("aria-selected", String(n === active));
    });
    const current = list[active];
    if (current) {
      input.setAttribute("aria-activedescendant", current.id);
      current.scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  };
  const render = async () => {
    const q = input.value.trim();
    all.hidden = !q;
    all.href = `/search/?q=${encodeURIComponent(q)}`;
    all.textContent = `See all results for “${q}”`;
    if (!q) {
      highlight(-1);
      return note("Type a function, a task or an exercise.");
    }
    const found = search(await loadIndex(), q).filter((i) => !scope || i.kind === scope);
    if (input.value.trim() !== q) return; // a newer keystroke is already rendering
    if (!found.length) {
      highlight(-1);
      return note(`No matches for “${q}”. Press Enter to search everything.`);
    }
    const per = scope ? 8 : 4;
    const frag = document.createDocumentFragment();
    let n = 0;
    for (const [kind, heading] of GROUPS) {
      const items: SearchItem[] = found.filter((i) => i.kind === kind).slice(0, per);
      if (!items.length) continue;
      const group = document.createElement("div");
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", heading);
      const h = document.createElement("p");
      h.className = "grp";
      h.setAttribute("aria-hidden", "true");
      h.textContent = heading;
      group.append(h);
      for (const item of items) {
        const a = document.createElement("a");
        a.id = `search-dialog-option-${n++}`;
        a.href = item.url;
        a.setAttribute("role", "option");
        a.setAttribute("aria-selected", "false");
        a.textContent = item.title;
        group.append(a);
      }
      frag.append(group);
    }
    box.replaceChildren(frag);
    highlight(0);
  };

  input.addEventListener("input", () => void render());
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      highlight(active + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter") {
      const chosen = options()[active];
      if (!chosen) return; // no match highlighted: the form posts to the search page
      e.preventDefault();
      location.assign(chosen.href);
    }
  });
  for (const chip of chips) {
    chip.addEventListener("click", () => {
      scope = chip.dataset["scope"] ?? "";
      for (const c of chips) c.setAttribute("aria-pressed", String(c === chip));
      input.focus();
      void render();
    });
  }
  // The header box hands over what is already typed.
  expand?.addEventListener("click", () => {
    input.value = pill?.value ?? "";
    pill?.blur(); // closes its suggestion list
    void render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "k" && (e.ctrlKey || e.metaKey) && shown(expand) && !dialog.open) {
      e.preventDefault();
      pill?.blur();
      dialog.showModal();
      void render();
    } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && shown(pill)) {
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/u.test(t.tagName))
      )
        return;
      e.preventDefault();
      pill?.focus();
    }
  });
}
