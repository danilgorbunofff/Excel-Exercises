// Why this exists: fills the progress page from this browser's storage: the
// numbers strip, the next exercise, the review cards and the counts, and clears
// progress on request. It paints again when a solve lands or when a signed-in
// visitor's account progress has been merged in, so the page is never stale.
import {
  clearProgress,
  dueDate,
  isDue,
  isSolved,
  localDay,
  needsReview,
  PROGRESS_EVENT,
  type Progress,
  readProgress,
} from "./progress.ts";
import { loadMe, SYNCED_EVENT } from "./session.ts";
import { paintStatus } from "./status.ts";

interface Item {
  id: string;
  number: number;
  title: string;
  href: string;
  /** Needs PRO. "Continue" skips these until the visitor is known to have PRO. */
  locked: boolean;
}
let pro = false;

const node = document.querySelector("script[data-exercises]");
const items: Item[] = node?.textContent ? JSON.parse(node.textContent) : [];
const drillNode = document.querySelector("script[data-drill-items]");
const drills: Item[] = drillNode?.textContent ? JSON.parse(drillNode.textContent) : [];
const q = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const next = q<HTMLAnchorElement>("[data-next]");
const summary = q<HTMLElement>("[data-summary]");
// The server-rendered first exercise, which is also the page with no progress.
const start = next ? { href: next.getAttribute("href") ?? "", text: next.textContent ?? "" } : null;

const stat = (key: string, value: string) => {
  const el = q(`[data-stat="${key}"]`);
  if (el) el.textContent = value;
};

/** How many review items to show; the rest wait until these are done. */
const REVIEW_MAX = 10;

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

// The head's second button: "Review N due" while anything is due, else today's exercise.
const reviewNext = q<HTMLAnchorElement>("[data-review-next]");
const today0 = reviewNext
  ? { href: reviewNext.getAttribute("href") ?? "", text: reviewNext.textContent ?? "" }
  : null;
const reviewIcon = q<HTMLTemplateElement>("template[data-review-icon]");

function paintReview(progress: Progress, today: string): void {
  const list = q<HTMLOListElement>("[data-review]");
  const empty = q<HTMLElement>("[data-review-empty]");
  if (!list || !empty) return;
  const due = reviewItems(progress, today);
  if (reviewNext && today0) {
    const first = due[0];
    reviewNext.href = first ? first.href : today0.href;
    reviewNext.textContent = first ? `Review ${due.length} due` : today0.text;
  }
  list.replaceChildren(
    ...due.slice(0, REVIEW_MAX).map((i) => {
      const e = progress[i.id];
      // A card like a track's: icon and why on top, the title, a Review button.
      const li = document.createElement("li");
      li.className = "card review-card";
      const top = document.createElement("div");
      top.className = "review-top";
      const box = document.createElement("span");
      box.className = "icon-box";
      if (reviewIcon) box.append(reviewIcon.content.cloneNode(true));
      const title = Object.assign(document.createElement("h3"), { textContent: i.title });
      const a = Object.assign(document.createElement("a"), {
        href: i.href,
        className: "button button-primary",
        textContent: "Review",
      });
      a.append(
        Object.assign(document.createElement("span"), {
          className: "visually-hidden",
          textContent: `: ${i.title}`,
        }),
      );
      const why = document.createElement("span");
      why.className = "why";
      const misses = e?.misses ?? 0;
      why.textContent = !isSolved(e)
        ? `Not solved yet, ${misses} wrong ${misses === 1 ? "check" : "checks"}`
        : (e?.missed ?? "") > (e?.last ?? "")
          ? "Wrong on your last try"
          : "Due for review";
      top.append(box, why);
      li.append(top, title, a);
      return li;
    }),
  );
  list.hidden = due.length === 0;
  empty.hidden = due.length > 0;
}

function paint(): void {
  const progress = readProgress();
  const today = localDay();
  paintReview(progress, today);
  const solved = items.filter((i) => isSolved(progress[i.id]));
  const helped = solved.filter((i) => progress[i.id]?.state === "helped").length;
  const due = solved
    .filter((i) => {
      const e = progress[i.id];
      return e ? isDue(e, today) : false;
    })
    .sort((a, b) =>
      (dueDate(progress[a.id] ?? { state: "solved", date: "" }) ?? "").localeCompare(
        dueDate(progress[b.id] ?? { state: "solved", date: "" }) ?? "",
      ),
    );

  stat("solved", String(solved.length));
  stat("own", String(solved.length - helped));
  stat("helped", String(helped));
  stat("due", String(due.length));

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
      next.href = "#all";
      next.textContent = "Every exercise solved";
    }
  }

  if (summary) {
    summary.textContent =
      solved.length === 0
        ? "You have not solved an exercise yet."
        : `You have solved ${solved.length} of ${items.length}${helped > 0 ? `, ${helped} of them with help` : ""}.`;
  }
}

paint();
void loadMe().then((me) => {
  pro = me?.pro === true;
  if (pro) paint();
});
// A solve repaints the numbers and the track cards and table marks.
document.addEventListener(PROGRESS_EVENT, () => {
  paint();
  paintStatus();
});
document.addEventListener(SYNCED_EVENT, () => {
  paint();
  paintStatus();
});

const ask = q<HTMLButtonElement>("[data-clear-ask]");
const confirm = q<HTMLElement>("[data-clear-confirm]");
const yes = q<HTMLButtonElement>("[data-clear-yes]");
const no = q<HTMLButtonElement>("[data-clear-no]");
const status = q<HTMLElement>("[data-clear-status]");
ask?.addEventListener("click", () => {
  if (!confirm || !yes) return;
  confirm.hidden = false;
  ask.hidden = true;
  yes.focus();
});
no?.addEventListener("click", () => {
  if (!confirm || !ask) return;
  confirm.hidden = true;
  ask.hidden = false;
  ask.focus();
});
yes?.addEventListener("click", () => {
  clearProgress();
  paint();
  paintStatus({});
  if (confirm && ask) {
    confirm.hidden = true;
    ask.hidden = false;
    ask.focus();
  }
  if (status) status.textContent = "Your progress is cleared.";
});
