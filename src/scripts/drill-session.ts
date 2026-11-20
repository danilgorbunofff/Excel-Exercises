// Why this exists: a run of tasks spread over their own pages, Previous and
// Next between them. Two kinds start one: the function practice picker
// (drills.ts) and the review list on the progress page (progress-page.ts).
// Each page in the run shows "Task N of M", sends the status bar's and the
// completion dialog's Next to the next task, lists the next few, and notes
// whether the task was solved and how many wrong checks it had before, for
// the drill summary. Kept in sessionStorage: one run per tab, gone with it.
import { sessionStep } from "../lib/drills.ts";
import { readProgress } from "./progress.ts";
import { track } from "./track.ts";

export interface DrillSession {
  kind: "drills" | "review";
  /** Each task's page, in order. */
  hrefs: string[];
  ids: string[];
  fns: string[];
  titles: string[];
  levels: number[];
  /** The picker address that started it, for "Practise again". */
  search: string;
  /** By drill id: wrong checks before the visit, and whether it was solved. */
  results: Record<string, { before: number; solved: boolean }>;
  /** Where Finish and the last task's Next go. */
  doneHref: string;
}

const KEY = "drill-session";
// Same words as LEVELS in lib/exercises.ts, which cannot load in the browser.
const LEVELS: Record<number, string> = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };
export const DONE_HREF = "/exercises/drills/?done";
export const drillHref = (slug: string) => `/exercises/drills/${slug}/`;
export const misses = (id: string) => readProgress()[id]?.misses ?? 0;

export function readSession(): DrillSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    const session = raw ? (JSON.parse(raw) as Partial<DrillSession>) : null;
    // A run saved before pages were stored by address counts as none.
    return session && Array.isArray(session.hrefs) ? (session as DrillSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: DrillSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Blocked storage: the first task still opens, without Previous and Next.
  }
}

const root = document.querySelector<HTMLElement>(".exercise-root[data-exercise]");
const here = location.pathname.endsWith("/") ? location.pathname : `${location.pathname}/`;
const session = root ? readSession() : null;
const step = session ? sessionStep(session.hrefs, here) : null;

if (root && session && step && step.index >= 0) {
  const review = session.kind === "review";
  const id = session.ids[step.index] ?? "";
  const last = step.next === null;
  const nextHref = step.next ?? session.doneHref;
  const nextFn = session.fns[step.index + 1];
  const nextName = session.titles?.[step.index + 1] || `Task ${step.index + 2}`;
  const end = review
    ? { label: "Back to your progress", word: "Progress", title: "Your progress" }
    : { label: "See your results", word: "Results", title: "Your results" };

  const bar = root.querySelector<HTMLElement>("[data-session]");
  const title = root.querySelector<HTMLElement>("[data-session-title]");
  const prev = root.querySelector<HTMLAnchorElement>("[data-session-prev]");
  const next = root.querySelector<HTMLAnchorElement>("[data-session-next]");
  if (title) {
    title.replaceChildren(
      "Task ",
      Object.assign(document.createElement("b"), { textContent: String(step.index + 1) }),
      ` of ${session.hrefs.length}`,
    );
  }
  if (prev) {
    if (step.prev) prev.href = step.prev;
    else {
      prev.removeAttribute("href");
      prev.setAttribute("aria-disabled", "true");
    }
  }
  if (next) {
    next.href = nextHref;
    const hidden = next.querySelector("[data-session-next-label]");
    if (hidden && last) hidden.textContent = end.label;
    const word = next.querySelector("[data-session-next-word]");
    if (word && last) word.textContent = end.word;
  }
  if (bar) bar.hidden = false;
  const finish = root.querySelector<HTMLAnchorElement>("[data-session-finish]");
  const back = root.querySelector<HTMLAnchorElement>("[data-session-back]");
  if (review && back) {
    // A review needs one way out, back to the due list, so the list link turns into it.
    back.href = session.doneHref;
    back.lastChild?.replaceWith(" Back to your progress");
  } else if (finish) {
    finish.href = session.doneHref;
    finish.hidden = false;
  }

  // The next few tasks of the set, listed like "More exercises" on an exercise page.
  const more = root.querySelector<HTMLElement>("[data-session-more]");
  const list = root.querySelector<HTMLUListElement>("[data-session-list]");
  const item = root.querySelector<HTMLTemplateElement>("template[data-session-item]");
  const mixed = new Set(session.fns.filter(Boolean)).size > 1;
  const upcoming = session.hrefs.slice(step.index + 1, step.index + 4);
  const moreTitle = root.querySelector<HTMLElement>("[data-session-more-title]");
  if (moreTitle && review) moreTitle.textContent = "Next to review";
  if (more && list && item && upcoming.length > 0) {
    list.replaceChildren(
      ...upcoming.map((s, k) => {
        const i = step.index + 1 + k;
        const li = item.content.firstElementChild?.cloneNode(true) as HTMLLIElement;
        const a = li.querySelector("a");
        if (a) {
          a.href = s;
          const name = session.titles?.[i] || `Task ${i + 1}`;
          // A mixed set names each task's function; a one-function set does not need to.
          a.textContent = mixed ? `${session.fns[i] ?? ""}: ${name}` : name;
        }
        const level = session.levels?.[i] ?? 0;
        const pill = li.querySelector<HTMLElement>(".level");
        if (pill && LEVELS[level]) {
          pill.classList.add(`level-${level}`);
          pill.textContent = LEVELS[level] ?? "";
        } else pill?.remove();
        return li;
      }),
    );
    more.hidden = false;
  }

  const label = last ? end.label : "Next task";
  for (const a of root.querySelectorAll<HTMLAnchorElement>("a[data-next]")) {
    a.href = nextHref;
    a.textContent = label;
  }
  const done = root.querySelector<HTMLAnchorElement>("[data-done-next]");
  if (done) {
    done.href = nextHref;
    done.setAttribute("aria-label", last ? label : `Next task: ${nextName}`);
    const words = done.firstChild;
    if (words?.nodeType === Node.TEXT_NODE) words.textContent = `${label} `;
  }
  const upNext = root.querySelector<HTMLElement>(".up-next-title");
  if (upNext) upNext.textContent = last ? end.title : nextFn ? `${nextFn}: ${nextName}` : nextName;

  // The first visit sets the baseline, so going back to a task does not reset it.
  session.results[id] ??= { before: misses(id), solved: false };
  saveSession(session);
  root.addEventListener("exercise-solved", () => {
    const now = readSession() ?? session;
    const result = now.results[id];
    if (result) result.solved = true;
    saveSession(now);
  });
  if (step.index === 0 && !review) {
    root.addEventListener("exercise-unlock", () => track("drill_start"), { once: true });
  }
}
