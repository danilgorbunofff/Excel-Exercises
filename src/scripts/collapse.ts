// Why this exists: long lists (128 exercises, 70 functions, every article)
// made phone pages 20,000 px tall. On phones a list shows its first few items
// and a "Show all" button; a search or filter shows every match, and wider
// screens always show everything. Without script nothing is hidden.

const phone = matchMedia("(max-width: 47.99rem)");

/**
 * Caps `items` to `cap` visible ones on phones, with a button placed after
 * `after`. Returns `refresh(filtering)`: call it whenever a filter has set
 * `hidden` on the items; `filtering` true turns the cap off. Capped items get
 * the class `is-capped` (hidden in base.css).
 */
export function collapse(after: Element, items: () => HTMLElement[], cap: number, noun: string) {
  let expanded = false;
  let filtering = false;
  const more = document.createElement("button");
  more.type = "button";
  more.className = "button button-secondary show-all";
  more.hidden = true;
  after.after(more);

  const refresh = (isFiltering = filtering) => {
    filtering = isFiltering;
    // A class, not `hidden`, so a filter's own hiding is never undone here.
    const shown = items().filter((el) => !el.hidden);
    const capped = phone.matches && !expanded && !filtering && shown.length > cap;
    for (const [i, el] of shown.entries()) el.classList.toggle("is-capped", capped && i >= cap);
    more.hidden = !capped;
    more.textContent = `Show all ${shown.length} ${noun}`;
  };

  more.addEventListener("click", () => {
    expanded = true;
    refresh();
    // Keep the reader's place: the next item gets focus, not the page top.
    items()
      .filter((el) => !el.hidden)
      [cap]?.querySelector<HTMLElement>("a, button")
      ?.focus();
  });
  phone.addEventListener("change", () => refresh());
  refresh();
  return refresh;
}
