// Why this exists: the function practice picker. Start (or any address with
// ?fn= or ?id=) saves the chosen tasks as a session and opens the first drill
// page; drill-session.ts moves through them. ?done shows the summary: how each
// task and each function went, and where to go on from there.
import {
  type DrillRef,
  drillQueue,
  type FnResult,
  functionResults,
  type TaskState,
  taskState,
} from "../lib/drills.ts";
import { DONE_HREF, drillHref, misses, readSession, saveSession } from "./drill-session.ts";
import { isSolved, readProgress } from "./progress.ts";
import { loadMe } from "./session.ts";
import { track } from "./track.ts";

const root = document.querySelector<HTMLElement>("[data-drills]");
const poolNode = root?.querySelector("script[data-drill-pool]");
const q = <T extends Element>(selector: string) => root?.querySelector<T>(selector) ?? null;

const params = new URLSearchParams(location.search);
const pool: DrillRef[] = poolNode?.textContent ? JSON.parse(poolNode.textContent) : [];
const queue = drillQueue(pool, { fns: params.getAll("fn"), id: params.get("id") });

// Past this many tasks the summary lists only what needs another look, in pages.
const BIG_RUN = 20;
const TASK_PAGE = 10;
const WEAK_SHOWN = 8;
const OUTCOMES: Record<TaskState, { word: string; tag: string }> = {
  correct: { word: "Solved", tag: "free" },
  retry: { word: "Took more tries", tag: "retry" },
  open: { word: "Not solved", tag: "" },
  none: { word: "Not opened", tag: "" },
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

function fill(selector: string, text: string): void {
  const node = q<HTMLElement>(selector);
  if (!node) return;
  node.textContent = text;
  node.hidden = text === "";
}

/** Shows the first rows, and a button that adds the next `step` of them. */
function paged<T>(
  list: HTMLElement | null,
  button: HTMLButtonElement | null,
  items: readonly T[],
  first: number,
  row: (item: T) => HTMLElement,
  words: (left: number) => string,
  step = first,
): void {
  if (!list || !button) return;
  let shown = 0;
  const more = (n: number) => {
    const added = items.slice(shown, shown + n).map(row);
    list.append(...added);
    shown += added.length;
    button.hidden = shown >= items.length;
    button.textContent = words(items.length - shown);
    return added[0];
  };
  list.replaceChildren();
  more(first);
  // Focus moves to the first new row: the button may be gone.
  button.onclick = () => more(step)?.querySelector("a")?.focus();
}

/** A folded list of functions, each a link that practises it. */
function folded(selector: string, label: string, fns: readonly FnResult[]): void {
  const box = q<HTMLElement>(selector);
  if (!box) return;
  box.hidden = fns.length === 0;
  const head = box.querySelector("summary");
  if (head)
    head.textContent = `${label}: ${fns.length} ${fns.length === 1 ? "function" : "functions"}`;
  box
    .querySelector("ul")
    ?.replaceChildren(
      ...fns.map((f) => el("li", {}, el("a", { href: practiseHref(f.fn), textContent: f.fn }))),
    );
}

const practiseHref = (fn: string) => `/exercises/drills/?fn=${encodeURIComponent(fn)}`;

/** The run's own tasks, for starting it, or part of it, again. */
const fromPool = (ids: readonly string[]) =>
  ids.map((id) => pool.find((d) => d.id === id)).filter((d): d is DrillRef => d !== undefined);

function summary(): void {
  const found = readSession();
  // The summary is for a function practice run, not a review run.
  const session = found?.kind === "drills" ? found : null;
  const box = q<HTMLElement>("[data-summary]");
  const picker = q<HTMLElement>("[data-picker]");
  if (!session || !box || !picker) return;
  picker.hidden = true;
  box.hidden = false;
  const lead = q<HTMLElement>(".open-head .lead");
  if (lead) lead.hidden = true;

  const tasks = session.ids.map((id, i) => {
    const result = session.results[id];
    return {
      id,
      n: i + 1,
      fn: session.fns[i] ?? "",
      href: session.hrefs[i] ?? "",
      title: session.titles?.[i] || `Task ${i + 1}`,
      state: taskState(result, misses(id) > (result?.before ?? 0)),
    };
  });
  type Task = (typeof tasks)[number];
  const of = (state: TaskState) => tasks.filter((t) => t.state === state);
  const unsolved = of("open");
  const unopened = of("none");
  const opened = tasks.length - unopened.length;
  const big = tasks.length > BIG_RUN;
  const fns = functionResults(tasks);

  fill(
    "[data-summary-context]",
    fns.length <= 3
      ? new Intl.ListFormat("en-GB").format(fns.map((f) => f.fn))
      : `${fns.length} functions, ${tasks.length} tasks`,
  );
  fill("[data-summary-line]", `${opened - unsolved.length} of ${opened} solved`);
  fill(
    "[data-summary-unopened]",
    unopened.length === 0
      ? ""
      : `${unopened.length} ${unopened.length === 1 ? "task" : "tasks"} not opened yet.`,
  );

  // Up to two actions: the first shown is the primary one.
  const next = q<HTMLAnchorElement>("[data-continue]");
  const retry = q<HTMLButtonElement>("[data-retry]");
  const again = q<HTMLButtonElement>("[data-again]");
  const resume = unopened[0];
  if (next && resume) {
    next.href = resume.href;
    next.textContent = `Continue from task ${resume.n}`;
    next.hidden = false;
  }
  if (retry && unsolved.length > 0) {
    retry.textContent = `Retry ${unsolved.length} unsolved`;
    retry.hidden = false;
    retry.onclick = () => start(fromPool(unsolved.map((t) => t.id)), session.search);
  }
  if (again && !resume) {
    again.hidden = false;
    again.onclick = () => start(fromPool(session.ids), session.search);
  }
  [next, retry, again]
    .filter((b) => b !== null && !b.hidden)
    .forEach((b, i) => {
      b?.classList.toggle("button-primary", i === 0);
      b?.classList.toggle("button-outline", i > 0);
    });

  const bar = q<HTMLElement>("[data-bar]");
  const segment = (state: TaskState, share?: number) => {
    const span = el("span", { className: state });
    if (share !== undefined) span.style.flexGrow = String(share);
    return span;
  };
  bar?.classList.toggle("shares", big);
  bar?.replaceChildren(
    ...(big
      ? (Object.keys(OUTCOMES) as TaskState[])
          .filter((s) => of(s).length > 0)
          .map((s) => segment(s, of(s).length))
      : tasks.map((t) => segment(t.state))),
  );
  for (const stat of box.querySelectorAll<HTMLElement>("[data-stat]")) {
    const state = stat.dataset["stat"] as TaskState;
    const value = stat.querySelector("dd");
    if (value) value.textContent = String(of(state).length);
    stat.hidden = state === "none" && unopened.length === 0;
  }

  // A short run lists every task; a long one only those to look at again.
  const listed = big ? [...unsolved, ...of("retry")] : tasks;
  const section = q<HTMLElement>("[data-tasks]");
  if (section) section.hidden = listed.length === 0;
  fill("[data-tasks-title]", big ? "Tasks to look at" : "Tasks");
  fill("[data-tasks-count]", big ? String(listed.length) : "");
  paged<Task>(
    q("[data-task-list]"),
    q("[data-more-tasks]"),
    listed,
    big ? TASK_PAGE : listed.length,
    (t) =>
      el(
        "li",
        { className: "a-item mid" },
        el("span", { className: "num", textContent: String(t.n) }),
        el(
          "div",
          { className: "body" },
          el("span", { className: "title" }, el("a", { href: t.href, textContent: t.title })),
        ),
        el("span", {
          className: `mark-tag ${OUTCOMES[t.state].tag}`,
          textContent: OUTCOMES[t.state].word,
        }),
      ),
    (left) => `Show ${Math.min(TASK_PAGE, left)} more of ${left}`,
  );

  // A long run puts the weakest functions at the side and folds the rest away.
  const weak = big
    ? fns.filter((f) => f.seen > 0 && f.first < f.total).sort((a, b) => b.weight - a.weight)
    : fns;
  folded(
    "[data-clean]",
    "Solved on the first try",
    big ? fns.filter((f) => f.first === f.total) : [],
  );
  folded("[data-unopened]", "Not opened", big ? fns.filter((f) => f.seen === 0) : []);
  const side = q<HTMLElement>("[data-fns]");
  if (side) side.hidden = weak.length === 0;
  fill("[data-fns-title]", big ? "Weakest functions" : "By function");
  paged<FnResult>(
    q("[data-fn-rows]"),
    q("[data-more-fns]"),
    weak,
    WEAK_SHOWN,
    (f) => {
      const link = el("a", { href: practiseHref(f.fn), textContent: "Practise" });
      link.setAttribute("aria-label", `Practise ${f.fn}`);
      return el(
        "tr",
        { className: f.solved < f.seen ? "weak" : "" },
        el("td", {}, el("code", { textContent: f.fn })),
        el("td", { className: "score", textContent: f.seen ? `${f.solved} of ${f.seen}` : "–" }),
        el("td", {}, link),
      );
    },
    () => `Show all ${weak.length} functions`,
    weak.length, // One press shows every function, not another page.
  );
  track("drill_finish");
  q<HTMLElement>("#done-title")?.focus();
}

/** Saves the chosen tasks and opens the first; replace, so Back returns to the picker. */
function start(chosen: DrillRef[] = queue, search: string = location.search): void {
  const first = chosen[0];
  if (!first) return;
  saveSession({
    kind: "drills",
    hrefs: chosen.map((d) => drillHref(d.slug)),
    ids: chosen.map((d) => d.id),
    fns: chosen.map((d) => d.fn),
    titles: chosen.map((d) => d.title ?? ""),
    levels: chosen.map((d) => d.level),
    search,
    results: {},
    doneHref: DONE_HREF,
  });
  location.replace(drillHref(first.slug));
}

// The picker: "Your set" follows the ticked functions, each group can be ticked
// at once, a filter narrows the list, a dot marks a function whose tasks are
// all solved, and Start needs at least one function ticked.
const picker = q<HTMLFormElement>("[data-picker]");
const byFn = new Map<string, string[]>();
for (const d of pool) byFn.set(d.fn, [...(byFn.get(d.fn) ?? []), d.id]);
const SET_SHOWN = 8;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function paintSet(form: HTMLFormElement): void {
  const boxes = [...form.querySelectorAll<HTMLInputElement>("input[name=fn]")];
  const chosen = boxes.filter((b) => b.checked).map((b) => b.value);
  const tasks = chosen.reduce((n, fn) => n + (byFn.get(fn)?.length ?? 0), 0);
  const chips = q<HTMLUListElement>("[data-set-chips]");
  const line = q<HTMLElement>("[data-set-count]");
  const total = q<HTMLElement>("[data-set-tasks]");
  const unit = q<HTMLElement>("[data-set-unit]");
  const clear = q<HTMLButtonElement>("[data-clear]");
  const start = q<HTMLButtonElement>("[data-start]");
  if (total) total.textContent = String(tasks);
  if (unit) unit.textContent = tasks === 1 ? "task" : "tasks";
  if (clear) clear.hidden = chosen.length === 0;
  if (start) {
    start.toggleAttribute("data-empty", chosen.length === 0);
    start.textContent = chosen.length === 0 ? "Start" : `Start ${plural(tasks, "task")}`;
  }
  if (chips) {
    chips.hidden = chosen.length === 0;
    const items = chosen
      .slice(0, SET_SHOWN)
      .map((fn) =>
        Object.assign(document.createElement("li"), { className: "chip", textContent: fn }),
      );
    if (chosen.length > SET_SHOWN)
      items.push(
        Object.assign(document.createElement("li"), {
          className: "more",
          textContent: `and ${chosen.length - SET_SHOWN} more`,
        }),
      );
    chips.replaceChildren(...items);
  }
  if (line) {
    line.removeAttribute("role");
    line.textContent =
      chosen.length === 0
        ? "Tick one or more functions."
        : `from ${plural(chosen.length, "function")}`;
  }
  for (const group of form.querySelectorAll<HTMLElement>("[data-group]")) {
    const toggle = group.querySelector<HTMLButtonElement>("[data-group-toggle]");
    const inGroup = [...group.querySelectorAll<HTMLInputElement>("input[name=fn]")];
    if (toggle) toggle.textContent = inGroup.every((b) => b.checked) ? "Clear" : "Select all";
    const count = group.querySelector<HTMLElement>("[data-group-count]");
    const picked = inGroup.filter((b) => b.checked).length;
    if (count) {
      count.hidden = picked === 0;
      count.textContent = `${picked} picked`;
    }
    // The group's line in the left list shows its picks once there are any.
    const nav = q<HTMLElement>(`[data-show-group="${group.dataset.group}"] [data-nav-count]`);
    if (nav) {
      nav.dataset.total ??= nav.textContent?.trim() ?? "";
      nav.classList.toggle("has-picks", picked > 0);
      // Just the number on screen; screen readers also hear "picked".
      if (picked > 0)
        nav.replaceChildren(
          String(picked),
          Object.assign(document.createElement("span"), {
            className: "visually-hidden",
            textContent: " picked",
          }),
        );
      else nav.textContent = nav.dataset.total ?? "";
    }
  }
}

/** The group shown in the middle pane while nothing is typed in the filter. */
let activeGroup = "";

/** Shows only the chosen group, or every group while the filter has text. */
function showGroups(form: HTMLFormElement): void {
  const filtering = (q<HTMLInputElement>("[data-filter]")?.value.trim() ?? "") !== "";
  for (const group of form.querySelectorAll<HTMLElement>("[data-group]")) {
    if (!filtering) {
      group.hidden = group.dataset.group !== activeGroup;
      for (const pick of group.querySelectorAll<HTMLElement>("[data-pick]")) pick.hidden = false;
    }
  }
  for (const b of form.querySelectorAll<HTMLButtonElement>("[data-show-group]")) {
    b.setAttribute("aria-pressed", String(!filtering && b.dataset.showGroup === activeGroup));
  }
}

/** Shows only the functions whose name holds the text, across every group, and hides empty groups. */
function filterPicks(form: HTMLFormElement, text: string): void {
  const needle = text.trim().toUpperCase();
  const none = q<HTMLElement>("[data-no-match]");
  if (!needle) {
    if (none) none.hidden = true;
    showGroups(form);
    return;
  }
  let shown = 0;
  for (const group of form.querySelectorAll<HTMLElement>("[data-group]")) {
    let inGroup = 0;
    for (const pick of group.querySelectorAll<HTMLElement>("[data-pick]")) {
      pick.hidden = !(pick.dataset.pick ?? "").includes(needle);
      if (!pick.hidden) inGroup += 1;
    }
    group.hidden = inGroup === 0;
    shown += inGroup;
  }
  if (none) none.hidden = shown > 0;
  showGroups(form);
}

if (picker) {
  // With JavaScript the groups become a list on the left and one shows at a time.
  const navList = q<HTMLElement>("[data-group-nav]");
  activeGroup = picker.querySelector<HTMLElement>("[data-group]")?.dataset.group ?? "";
  if (navList) {
    navList.hidden = false;
    for (const b of navList.querySelectorAll<HTMLButtonElement>("[data-show-group]")) {
      b.addEventListener("click", () => {
        activeGroup = b.dataset.showGroup ?? "";
        const filter = q<HTMLInputElement>("[data-filter]");
        if (filter) filter.value = "";
        filterPicks(picker, "");
      });
    }
    showGroups(picker);
  }
  for (const group of picker.querySelectorAll<HTMLElement>("[data-group]")) {
    const toggle = group.querySelector<HTMLButtonElement>("[data-group-toggle]");
    if (!toggle) continue;
    toggle.hidden = false;
    toggle.addEventListener("click", () => {
      const inGroup = [...group.querySelectorAll<HTMLInputElement>("input[name=fn]")];
      const tick = !inGroup.every((b) => b.checked);
      for (const b of inGroup) b.checked = tick;
      paintSet(picker);
    });
  }
  q<HTMLButtonElement>("[data-clear]")?.addEventListener("click", () => {
    for (const b of picker.querySelectorAll<HTMLInputElement>("input[name=fn]")) b.checked = false;
    paintSet(picker);
  });
  const filter = q<HTMLInputElement>("[data-filter]");
  const wrap = q<HTMLElement>("[data-filter-wrap]");
  if (filter && wrap) {
    wrap.hidden = false;
    filter.addEventListener("input", () => filterPicks(picker, filter.value));
    // Enter in the filter must not start a session.
    filter.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.preventDefault();
    });
  }
  const progress = readProgress();
  for (const pick of picker.querySelectorAll<HTMLElement>("[data-pick]")) {
    const ids = byFn.get(pick.dataset.pick ?? "") ?? [];
    const dot = pick.querySelector<HTMLElement>("[data-done]");
    if (dot) dot.hidden = ids.length === 0 || !ids.every((id) => isSolved(progress[id]));
  }
  picker.addEventListener("change", () => paintSet(picker));
  // Back from a session, the browser may have kept the ticks.
  paintSet(picker);
  picker.addEventListener("submit", (e) => {
    const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name === "fn") return;
    if (!picker.querySelector("input[name=fn]:checked")) {
      e.preventDefault();
      q<HTMLElement>("[data-pick-hint]")?.setAttribute("role", "alert");
      picker.querySelector<HTMLInputElement>("input[name=fn]:not([hidden] *)")?.focus();
    }
  });
}

// "10 random tasks": PRO picks in the browser; a Free account runs the ten the
// server keeps for today; a signed out visitor is sent to sign up.
const wantsRandom =
  !params.get("id") &&
  !params.getAll("fn").includes("all") &&
  params.getAll("fn").includes("random");
const randomLabel = q<HTMLElement>("[data-random-label]");
const freeNote = q<HTMLElement>("[data-free-note]");
const todaysRun = (slugs: readonly string[]) =>
  slugs.map((s) => pool.find((d) => d.slug === s)).filter((d): d is DrillRef => d !== undefined);
const allSolved = (run: DrillRef[]) => {
  const progress = readProgress();
  return run.length > 0 && run.every((d) => isSolved(progress[d.id]));
};

async function startRandom(): Promise<void> {
  const me = await loadMe();
  if (me?.pro) return start();
  if (!me) {
    location.replace("/register/?next=/exercises/drills/");
    return;
  }
  const res = await fetch("/api/drills/free-run/", {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { slugs?: string[]; pro?: boolean } | null;
  if (body?.pro) return start();
  const run = todaysRun(body?.slugs ?? []);
  history.replaceState(null, "", location.pathname);
  if (run.length === 0 || allSolved(run)) {
    if (freeNote) {
      freeNote.hidden = false;
      freeNote.replaceChildren(
        run.length === 0
          ? "Today's 10 tasks could not be loaded. Try again in a minute."
          : "You have solved today's 10 tasks. New ones come tomorrow, or get PRO for unlimited tasks. ",
        ...(run.length === 0
          ? []
          : [
              Object.assign(document.createElement("a"), {
                href: "/pricing/",
                textContent: "See PRO",
              }),
            ]),
      );
    }
    return;
  }
  track("drill_free_run");
  start(run);
}

/** Labels the random button for a signed-in Free account from today's run. */
async function labelRandom(): Promise<void> {
  const me = await loadMe();
  if (!me || me.pro || !randomLabel) return;
  const res = await fetch("/api/drills/free-run/", { credentials: "same-origin" }).catch(
    () => null,
  );
  const body = (await res?.json().catch(() => null)) as { today?: string[] | null } | null;
  const run = todaysRun(body?.today ?? []);
  randomLabel.textContent =
    run.length === 0
      ? "10 random tasks · free today"
      : allSolved(run)
        ? "Today's 10 tasks · done"
        : "Continue today's 10 tasks";
}

if (root && wantsRandom) void startRandom();
else if (root && queue.length > 0) start();
else if (root && params.has("done")) summary();
if (root && !wantsRandom && !params.has("done")) void labelRandom();
