// Why this exists: the bubble over a cell under the pointer or keyboard focus,
// shared by the Progress heatmap and the daily calendars. The native title one
// is slow and absent in some webviews. A cell opts in with data-tip (the bold
// line) and data-day (the small one); the bubble's dot is data-dot, else the
// cell's own colour.
// The bubble is aria-hidden: each cell carries its own words for screen readers.

/** Shows tip (a .hover-tip inside a positioned box) over the [data-tip] cells of grid. */
export function bindHoverTip(grid: HTMLElement, tip: HTMLElement | null): void {
  const box = tip?.parentElement;
  if (!tip || !box || grid.dataset.tipBound !== undefined) return;
  grid.dataset.tipBound = "";
  const [line, sub] = [tip.querySelector("strong"), tip.querySelector("span")];
  const show = (target: EventTarget | null) => {
    const cell = (target as HTMLElement | null)?.closest<HTMLElement>("[data-tip]");
    if (!cell || !line || !sub) return tip.classList.remove("show");
    line.textContent = cell.dataset.tip ?? "";
    sub.textContent = cell.dataset.day ?? "";
    const c = cell.getBoundingClientRect();
    const k = box.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const mid = c.left - k.left + c.width / 2;
    const left = Math.min(Math.max(mid, half), k.width - half) - half;
    tip.style.left = `${left}px`;
    tip.style.top = `${c.top - k.top - 13}px`;
    tip.style.setProperty("--arrow", `${mid - left}px`);
    tip.style.setProperty("--dot", cell.dataset.dot ?? getComputedStyle(cell).backgroundColor);
    // Set the place while hidden (no transition), so it glides only between cells.
    void tip.offsetWidth;
    tip.classList.add("show");
  };
  const hide = () => tip.classList.remove("show");
  grid.addEventListener("pointerover", (e) => show(e.target));
  grid.addEventListener("pointerleave", hide);
  grid.addEventListener("focusin", (e) => show(e.target));
  grid.addEventListener("focusout", hide);
}
