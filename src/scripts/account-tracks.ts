// Why this exists: fills the "By track" table on the account Progress page
// (solved count, bar, status) and its group filter. It paints again when
// session.ts has merged the account's progress in.
import { type ProfileItem, profileStats } from "./profile-stats.ts";
import { readProgress } from "./progress.ts";
import { SYNCED_EVENT } from "./session.ts";

// The exercise list ProgressBody.astro already embeds for progress-page.ts.
const node = document.querySelector("script[data-exercises]");
const items: ProfileItem[] = node?.textContent ? JSON.parse(node.textContent) : [];

function paint(): void {
  const { tracks } = profileStats(items, readProgress());
  for (const row of document.querySelectorAll<HTMLElement>("[data-track]")) {
    const t = tracks.get(row.dataset.track ?? "") ?? { solved: 0, total: 0 };
    const count = row.querySelector("[data-count]");
    if (count) count.textContent = String(t.solved);
    const fill = row.querySelector<HTMLElement>("[data-fill]");
    if (fill) fill.style.width = `${t.total ? (t.solved / t.total) * 100 : 0}%`;
    const state = row.querySelector("[data-state]");
    if (!state) continue;
    const pill = document.createElement("span");
    if (t.total && t.solved === t.total)
      [pill.className, pill.textContent] = ["pill ok", "Finished"];
    else if (t.solved) [pill.className, pill.textContent] = ["pill", "In progress"];
    else [pill.className, pill.textContent] = ["fine", "Not started"];
    state.replaceChildren(pill);
  }
}

const filter = document.querySelector("[data-track-filter]");
filter?.addEventListener("click", (e) => {
  const button = (e.target as Element).closest<HTMLButtonElement>("[data-group]");
  if (!button) return;
  for (const b of filter.querySelectorAll("[data-group]"))
    b.setAttribute("aria-pressed", String(b === button));
  moveThumb();
  const group = button.dataset.group;
  let shown = 0;
  for (const row of document.querySelectorAll<HTMLElement>("[data-track]")) {
    row.hidden = Boolean(group) && row.dataset.trackGroup !== group;
    if (row.hidden) continue;
    // Restart the settle-in animation on each row that stays, staggered down the table.
    row.classList.remove("row-in");
    row.style.setProperty("--i", String(Math.min(shown++, 8)));
    void row.offsetWidth;
    row.classList.add("row-in");
  }
});

/** Slides the thumb under the pressed button. */
function moveThumb(): void {
  const pressed = filter?.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (!(filter instanceof HTMLElement) || !pressed) return;
  filter.style.setProperty("--x", `${pressed.offsetLeft}px`);
  filter.style.setProperty("--w", `${pressed.offsetWidth}px`);
  filter.dataset.thumb = "";
}
moveThumb();
if (filter) new ResizeObserver(moveThumb).observe(filter);

paint();
document.addEventListener(SYNCED_EVENT, paint);
