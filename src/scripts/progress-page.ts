// Why this exists: fills the progress page from this browser's storage: the
// numbers band, the next exercise, the review list and the counts, and clears
// progress on request. It paints again when a solve lands or when a signed-in
// visitor's account progress has been merged in, so the page is never stale.
import {
  clearProgress,
  dueDate,
  isDue,
  localDay,
  PROGRESS_EVENT,
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
const q = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const next = q<HTMLAnchorElement>("[data-next]");
const summary = q<HTMLElement>("[data-summary]");
// The server-rendered first exercise, which is also the page with no progress.
const start = next ? { href: next.getAttribute("href") ?? "", text: next.textContent ?? "" } : null;

const stat = (key: string, value: string) => {
  const el = q(`[data-stat="${key}"]`);
  if (el) el.textContent = value;
};

function paint(): void {
  const progress = readProgress();
  const today = localDay();
  const solved = items.filter((i) => {
    const s = progress[i.id]?.state;
    return s === "solved" || s === "helped";
  });
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

  stat("solved", `${solved.length} of ${items.length}`);
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
document.addEventListener(PROGRESS_EVENT, paint);
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
