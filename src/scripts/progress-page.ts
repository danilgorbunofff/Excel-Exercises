// Why this exists: fills the progress page from this browser's storage: the
// next exercise, the review list and the counts, and clears progress on request.
import { clearProgress, dueDate, isDue, localDay, readProgress } from "./progress.ts";
import { paintStatus } from "./status.ts";

interface Item {
  id: string;
  number: number;
  title: string;
  href: string;
}

// The page as the server rendered it, which is also the page with no progress.
const pristine = new Map(
  [...document.querySelectorAll<HTMLElement>("[data-next], [data-due-empty], [data-summary]")].map(
    (el) => [el, [...el.childNodes].map((n) => n.cloneNode(true))],
  ),
);
const node = document.querySelector("script[data-exercises]");
const items: Item[] = node?.textContent ? JSON.parse(node.textContent) : [];
const progress = readProgress();
const today = localDay();

const link = (item: Item) => {
  const a = document.createElement("a");
  a.href = item.href;
  a.textContent = item.title;
  return a;
};

const solved = items.filter((i) => {
  const s = progress[i.id]?.state;
  return s === "solved" || s === "helped";
});
const helped = solved.filter((i) => progress[i.id]?.state === "helped");

const next = items.find((i) => !solved.includes(i));
const nextLine = document.querySelector<HTMLElement>("[data-next]");
if (nextLine && solved.length > 0) {
  if (next) {
    nextLine.replaceChildren(
      "Exercise ",
      String(next.number),
      " of ",
      String(items.length),
      ": ",
      link(next),
      ".",
    );
  } else {
    nextLine.textContent =
      "You have solved every exercise. The review list below keeps them fresh.";
  }
}

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
const dueList = document.querySelector<HTMLElement>("[data-due]");
const dueEmpty = document.querySelector<HTMLElement>("[data-due-empty]");
if (dueList && dueEmpty && due.length > 0) {
  dueList.replaceChildren(
    ...due.map((i) => {
      const li = document.createElement("li");
      li.append(link(i));
      return li;
    }),
  );
  dueList.hidden = false;
  dueEmpty.textContent = `${due.length} ${due.length === 1 ? "exercise is" : "exercises are"} due. Solve ${due.length === 1 ? "it" : "them"} again to space out the next review.`;
}

const summary = document.querySelector<HTMLElement>("[data-summary]");
if (summary && solved.length > 0) {
  summary.textContent = `You have solved ${solved.length} of ${items.length}${
    helped.length > 0 ? `, ${helped.length} of them with help` : ""
  }.`;
}

const ask = document.querySelector<HTMLButtonElement>("[data-clear-ask]");
const confirm = document.querySelector<HTMLElement>("[data-clear-confirm]");
const yes = document.querySelector<HTMLButtonElement>("[data-clear-yes]");
const no = document.querySelector<HTMLButtonElement>("[data-clear-no]");
const status = document.querySelector<HTMLElement>("[data-clear-status]");
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
  for (const [el, nodes] of pristine) el.replaceChildren(...nodes);
  if (dueList) dueList.hidden = true;
  paintStatus({});
  if (confirm && ask) {
    confirm.hidden = true;
    ask.hidden = false;
    ask.focus();
  }
  if (status) status.textContent = "Your progress is cleared.";
});
