// Why this exists: fills the progress page from this browser's storage: the
// grid of days practised, the numbers, the next exercise, the due-for-review table (filter, sort,
// Show all; a title opens a run through what it shows) and clears
// progress on request. It paints again when a solve lands or when a signed-in
// visitor's account progress has been merged in, so the page is never stale.

import {
  type CatalogueFilter,
  type CatalogueRow,
  compare,
  matches,
  type SortDir,
  type SortKey,
} from "../lib/catalogue.ts";
import { bestStreak, currentStreak } from "../lib/daily.ts";
import { readDaily } from "./daily-store.ts";
import { dayCount, longDate } from "./daily-view.ts";
import { saveSession } from "./drill-session.ts";
import { bindHoverTip } from "./hover-tip.ts";
import {
  activeDays,
  addDays,
  clearProgress,
  dueDate,
  isSolved,
  localDay,
  needsReview,
  PROGRESS_EVENT,
  type Progress,
  readProgress,
} from "./progress.ts";
import { loadMe, SYNCED_EVENT, signedIn } from "./session.ts";

interface Item {
  id: string;
  number: number;
  title: string;
  href: string;
  /** Needs PRO. "Continue" skips these until the visitor is known to have PRO. */
  locked: boolean;
  level: number;
  track: string;
  trackTitle: string;
  fns: string[];
}
// Same words as LEVELS in lib/exercises.ts, which cannot load in the browser.
const LEVEL_NAMES: Record<number, string> = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };
let pro = false;

const node = document.querySelector("script[data-exercises]");
const items: Item[] = node?.textContent ? JSON.parse(node.textContent) : [];
const drillNode = document.querySelector("script[data-drill-items]");
const drills: Item[] = drillNode?.textContent ? JSON.parse(drillNode.textContent) : [];
const q = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const next = q<HTMLAnchorElement>("[data-next]");
// The server-rendered first exercise, which is also the page with no progress.
const start = next ? { href: next.getAttribute("href") ?? "", text: next.textContent ?? "" } : null;

const stat = (key: string, value: string) => {
  const el = q(`[data-stat="${key}"]`);
  if (el) el.textContent = value;
};

/** Weeks in the grid of days practised: about six months. */
const HEAT_WEEKS = 26;

/**
 * Draws the grid of days practised, a column per week from Monday, ending
 * with this week, and the practice streak beside it.
 */
function paintActivity(progress: Progress, today: string): void {
  const days = activeDays(progress, Object.keys(readDaily()));
  const set = new Set(days.keys());
  stat("streak", dayCount(currentStreak(set, today)));
  stat("best", dayCount(bestStreak(set)));
  const grid = q("[data-heat]");
  const months = q("[data-heat-months]");
  if (!grid || !months) return;
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const first = addDays(today, -weekday - (HEAT_WEEKS - 1) * 7);
  let practised = 0;
  const cells = Array.from({ length: HEAT_WEEKS * 7 }, (_, i) => {
    const day = addDays(first, i);
    const n = day > today ? 0 : (days.get(day) ?? 0);
    if (n) practised++;
    const cell = document.createElement("i");
    if (day > today) cell.className = "future";
    else if (n) {
      cell.className = `l${n >= 5 ? 4 : Math.min(n, 3)}`;
      cell.dataset.tip = `${n} ${n === 1 ? "exercise" : "exercises"}`;
      cell.dataset.day = longDate(day);
    }
    return cell;
  });
  grid.replaceChildren(...cells);
  bindHoverTip(grid, q("[data-heat-tip]"));
  grid.setAttribute(
    "aria-label",
    practised ? `Practised on ${dayCount(practised)} in the last 6 months` : "No practice yet",
  );
  // A month name over the first week that starts in it, so labels never crowd.
  months.replaceChildren(
    ...Array.from({ length: HEAT_WEEKS }, (_, w) => {
      const monday = addDays(first, w * 7);
      const label = document.createElement("span");
      if (Number(monday.slice(8)) <= 7)
        label.textContent = new Date(`${monday}T00:00:00Z`).toLocaleDateString("en-GB", {
          month: "short",
          timeZone: "UTC",
        });
      return label;
    }),
  );
}

/** Rows shown before "Show all": a long due list stays a short table. */
const REVIEW_SHOWN = 10;

/** Missed and unsolved first (most misses on top), then the rest by due day. */
function reviewItems(progress: Progress, today: string): Item[] {
  const key = (i: Item) => {
    const e = progress[i.id];
    return isSolved(e) ? (dueDate(e ?? { state: "solved", date: "" }) ?? today) : "";
  };
  return [...items, ...drills]
    .filter((i) => needsReview(progress[i.id], today) && (pro || !i.locked))
    .sort(
      (a, b) =>
        key(a).localeCompare(key(b)) ||
        (progress[b.id]?.misses ?? 0) - (progress[a.id]?.misses ?? 0),
    );
}

/** Why an item is on the list, as a sort key and the words shown for it. */
function reasonOf(progress: Progress, id: string): { key: string; text: string } {
  const e = progress[id];
  const misses = e?.misses ?? 0;
  if (!isSolved(e))
    return {
      key: "unsolved",
      text: `Not solved yet, ${misses} wrong ${misses === 1 ? "check" : "checks"}`,
    };
  if ((e?.missed ?? "") > (e?.last ?? "")) return { key: "missed", text: "Wrong on your last try" };
  return { key: "due", text: "Due for review" };
}

// The head's second button: "Review N due" while anything is due, else today's exercise.
const reviewNext = q<HTMLAnchorElement>("[data-review-next]");
const today0 = reviewNext
  ? { href: reviewNext.getAttribute("href") ?? "", text: reviewNext.textContent ?? "" }
  : null;

interface ReviewRow {
  item: Item;
  row: CatalogueRow;
  el: HTMLTableRowElement;
}
let dueNow: Item[] = [];
let rowsNow: ReviewRow[] = [];
let sortKey: SortKey = "order";
let sortDir: SortDir = "ascending";
let showAll = false;

/** A run through these items, in this order: the page opened from the list
 * gets Previous and Next through it, and the last one leads back here. Saved
 * on the click, so a visit here does not end a function practice run. */
function startReview(run: readonly Item[]): void {
  if (run.length === 0) return;
  saveSession({
    kind: "review",
    hrefs: run.map((i) => i.href),
    ids: run.map((i) => i.id),
    fns: run.map(() => ""),
    titles: run.map((i) => i.title),
    levels: run.map((i) => i.level),
    search: "",
    results: {},
    doneHref: "/progress/",
  });
}
reviewNext?.addEventListener("click", () => startReview(dueNow));

const reviewForm = q<HTMLFormElement>("[data-review-filter]");
const reviewBody = q<HTMLTableSectionElement>("[data-review-rows]");
const reviewCount = q<HTMLElement>("[data-review-count]");
const activeTag = q<HTMLElement>("[data-review-active]");
const resetButton = q<HTMLElement>("[data-review-reset]");
const moreWrap = q<HTMLElement>("[data-review-more-wrap]");
const moreButton = q<HTMLButtonElement>("[data-review-more]");
const headers = [
  ...document.querySelectorAll<HTMLTableCellElement>("[data-review-table] th[data-sort-key]"),
];
const field = (name: string) =>
  reviewForm?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;

/** The rows that pass the filter, in the chosen order: what the table shows and the run follows. */
function filteredRows(): ReviewRow[] {
  const f: CatalogueFilter = {
    q: field("q")?.value ?? "",
    fn: "",
    level: field("level")?.value ?? "",
    track: field("track")?.value ?? "",
    progress: "",
  };
  const why = field("why")?.value ?? "";
  return rowsNow
    .filter((r) => matches(r.row, f) && (!why || r.row.state === why))
    .sort((a, b) => compare(a.row, b.row, sortKey, sortDir));
}

function paintTable(): void {
  if (!reviewBody) return;
  const shown = filteredRows();
  const visible = showAll ? shown : shown.slice(0, REVIEW_SHOWN);
  reviewBody.replaceChildren(...visible.map((r) => r.el));
  for (const th of headers) {
    if (th.dataset["sortKey"] === sortKey && sortKey !== "order")
      th.setAttribute("aria-sort", sortDir);
    else th.removeAttribute("aria-sort");
  }
  const total = rowsNow.length;
  if (reviewCount) {
    const line =
      shown.length === total
        ? `${total} due`
        : shown.length === 0
          ? `No exercise matches these filters. Clear them to see all ${total}.`
          : `${shown.length} of ${total} due`;
    // The number leads in bold: "1 of 2 due".
    const m = /^(\d+)(.*)$/.exec(line);
    if (m)
      reviewCount.replaceChildren(
        Object.assign(document.createElement("b"), { textContent: m[1] }),
        m[2] ?? "",
      );
    else reviewCount.textContent = line;
  }
  const active = [field("q"), field("why"), field("level"), field("track")].filter((el) =>
    el?.value.trim(),
  ).length;
  if (activeTag) {
    activeTag.hidden = active === 0;
    activeTag.textContent = `${active} active`;
  }
  if (resetButton) resetButton.hidden = active === 0;
  const hiddenCount = shown.length - visible.length;
  if (moreWrap && moreButton) {
    moreWrap.hidden = hiddenCount <= 0;
    moreButton.textContent = `Show all ${shown.length}`;
  }
}

function buildRow(item: Item, progress: Progress, urgency: number): ReviewRow {
  const reason = reasonOf(progress, item.id);
  const tr = document.createElement("tr");
  const whyCell = document.createElement("td");
  whyCell.append(
    Object.assign(document.createElement("span"), {
      className: "why",
      textContent: reason.text,
    }),
  );
  whyCell.firstElementChild?.setAttribute("data-why", reason.key);
  const titleCell = document.createElement("th");
  titleCell.scope = "row";
  titleCell.append(
    Object.assign(document.createElement("a"), {
      className: "r-title",
      href: item.href,
      textContent: item.title,
    }),
    Object.assign(document.createElement("span"), {
      className: "r-meta",
      textContent: [item.fns.join(", ") || "Cell references", item.trackTitle].join(" · "),
    }),
  );
  const levelCell = document.createElement("td");
  levelCell.append(
    Object.assign(document.createElement("span"), {
      className: `badge badge-${item.level}`,
      textContent: LEVEL_NAMES[item.level] ?? "",
    }),
  );
  tr.append(whyCell, titleCell, levelCell);
  return {
    item,
    el: tr,
    row: {
      order: urgency,
      title: item.title,
      level: item.level,
      track: item.track,
      search: [item.title, ...item.fns].join(" ").toLowerCase(),
      functions: item.fns,
      state: reason.key,
    },
  };
}

function paintReview(progress: Progress, today: string): void {
  const box = q<HTMLElement>("[data-review]");
  const empty = q<HTMLElement>("[data-review-empty]");
  if (!box || !empty) return;
  const due = reviewItems(progress, today);
  dueNow = due;
  stat("due", String(due.length));
  if (reviewNext && today0) {
    const first = due[0];
    reviewNext.href = first ? first.href : today0.href;
    reviewNext.textContent = first ? `Review ${due.length} due` : today0.text;
  }
  rowsNow = due.map((item, i) => buildRow(item, progress, i + 1));
  // The track filter offers only the tracks that have something due.
  const tracks = field("track");
  if (tracks instanceof HTMLSelectElement) {
    const chosen = tracks.value;
    const seen = new Map(due.map((i) => [i.track, i.trackTitle]));
    tracks.replaceChildren(
      new Option("All", ""),
      ...[...seen].map(([slug, title]) => new Option(title, slug, false, slug === chosen)),
    );
  }
  paintTable();
  box.hidden = due.length === 0;
  empty.hidden = due.length > 0;
}

if (reviewForm) {
  const again = () => {
    showAll = false;
    paintTable();
  };
  reviewForm.addEventListener("input", again);
  reviewForm.addEventListener("change", again);
  reviewForm.addEventListener("submit", (e) => {
    e.preventDefault();
    again();
  });
  reviewForm.addEventListener("reset", () => setTimeout(again));
}
moreButton?.addEventListener("click", () => {
  showAll = true;
  paintTable();
});
for (const th of headers) {
  th.querySelector("button")?.addEventListener("click", () => {
    const k = th.dataset["sortKey"] as SortKey;
    if (k === sortKey) {
      // Third click goes back to the most urgent first.
      if (sortDir === "descending") {
        sortKey = "order";
        sortDir = "ascending";
      } else sortDir = "descending";
    } else {
      sortKey = k;
      sortDir = "ascending";
    }
    paintTable();
  });
}
// A title opens a run through what the table holds now, filtered and sorted,
// starting from that row.
reviewBody?.addEventListener("click", (e) => {
  const link = (e.target as Element).closest("a");
  if (!link) return;
  startReview(filteredRows().map((r) => r.item));
});

function paint(): void {
  const progress = readProgress();
  const today = localDay();
  paintReview(progress, today);
  paintActivity(progress, today);
  const solved = items.filter((i) => isSolved(progress[i.id]));
  const helped = solved.filter((i) => progress[i.id]?.state === "helped").length;

  stat("solved", String(solved.length));
  stat("own", String(solved.length - helped));
  stat("helped", String(helped));

  const upNext = items.find((i) => !solved.includes(i) && (pro || !i.locked));
  if (next && start) {
    if (solved.length === 0) {
      next.href = start.href;
      next.textContent = start.text;
    } else if (upNext) {
      next.href = upNext.href;
      next.textContent = `Continue: ${upNext.title}`;
    } else if (solved.length < items.length) {
      // Every free one is solved; the rest need PRO.
      next.href = "/pricing/";
      next.textContent = "Get PRO for the next exercises";
    } else {
      next.href = "/exercises/";
      next.textContent = "Every exercise solved";
    }
  }
}

paint();
void loadMe().then((me) => {
  pro = me?.pro === true;
  if (pro) paint();
});
// A solve, or progress merged from the account, repaints the numbers and the review list.
document.addEventListener(PROGRESS_EVENT, paint);
document.addEventListener(SYNCED_EVENT, paint);

// Clearing asks first in a dialog; Keep it, Esc or a click outside closes it
// with nothing cleared, and the browser puts focus back on the button. Signed
// in, the account's copy goes first: clearing only this browser would come
// back on the next sync, and stay on every other device.
const ask = q<HTMLButtonElement>("[data-clear-ask]");
const dialog = q<HTMLDialogElement>("[data-clear-dialog]");
const yes = q<HTMLButtonElement>("[data-clear-yes]");
const no = q<HTMLButtonElement>("[data-clear-no]");
const status = q<HTMLElement>("[data-clear-status]");
const failed = q<HTMLElement>("[data-clear-error]");
ask?.addEventListener("click", () => {
  if (status) status.textContent = "";
  if (failed) failed.textContent = "";
  dialog?.showModal();
});
no?.addEventListener("click", () => dialog?.close());
yes?.addEventListener("click", async () => {
  if (signedIn()) {
    yes.disabled = true;
    const res = await fetch("/api/progress/", {
      method: "DELETE",
      credentials: "same-origin",
    }).catch(() => null);
    yes.disabled = false;
    if (!res?.ok) {
      if (failed)
        failed.textContent =
          "Your account could not be reached, so nothing was cleared. Try again in a moment.";
      return;
    }
  }
  clearProgress();
  paint();
  dialog?.close();
  if (status)
    status.textContent = signedIn()
      ? "Your progress is cleared, on this and every other device."
      : "Your progress is cleared.";
});
