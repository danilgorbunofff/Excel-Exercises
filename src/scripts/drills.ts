// Why this exists: the function practice picker. Start (or any address with
// ?fn= or ?id=) saves the chosen tasks as a session and opens the first drill
// page; drill-session.ts moves through them. ?done shows the summary: how many
// were solved, and the functions that needed more than one try.
import { type DrillRef, drillQueue } from "../lib/drills.ts";
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

function summary(): void {
  const found = readSession();
  // The summary is for a function practice run, not a review run.
  const session = found?.kind === "drills" ? found : null;
  const box = q<HTMLElement>("[data-summary]");
  const picker = q<HTMLElement>("[data-picker]");
  if (!session || !box || !picker) return;
  picker.hidden = true;
  box.hidden = false;
  const outcomes = session.ids
    .map((id, i) => ({ id, fn: session.fns[i] ?? "", result: session.results[id] }))
    .filter((o) => o.result !== undefined)
    .map((o) => ({
      fn: o.fn,
      solved: o.result?.solved === true,
      missed: misses(o.id) > (o.result?.before ?? 0),
    }));
  const solved = outcomes.filter((o) => o.solved).length;
  const line = q<HTMLElement>("[data-summary-line]");
  if (line)
    line.textContent = `You solved ${solved} of ${outcomes.length} ${outcomes.length === 1 ? "task" : "tasks"}.`;
  const weak = [...new Set(outcomes.filter((o) => o.missed || !o.solved).map((o) => o.fn))];
  const list = q<HTMLUListElement>("[data-missed-list]");
  const wrap = q<HTMLElement>("[data-summary-missed]");
  if (list && wrap) {
    list.replaceChildren(
      ...weak.map((fn) => {
        const li = document.createElement("li");
        li.append(
          Object.assign(document.createElement("a"), {
            href: `/exercises/drills/?fn=${encodeURIComponent(fn)}`,
            textContent: `Practise ${fn} again`,
          }),
          " or ",
          Object.assign(document.createElement("a"), {
            href: `/exercises/?fn=${encodeURIComponent(fn)}`,
            textContent: `see the ${fn} exercises`,
          }),
        );
        return li;
      }),
    );
    wrap.hidden = weak.length === 0;
  }
  const again = q<HTMLAnchorElement>("[data-again]");
  if (again) again.href = `/exercises/drills/${session.search}`;
  track("drill_finish");
  q<HTMLElement>("#done-title")?.focus();
}

/** Saves the chosen tasks and opens the first; replace, so Back returns to the picker. */
function start(chosen: DrillRef[] = queue): void {
  const first = chosen[0];
  if (!first) return;
  saveSession({
    kind: "drills",
    hrefs: chosen.map((d) => drillHref(d.slug)),
    ids: chosen.map((d) => d.id),
    fns: chosen.map((d) => d.fn),
    titles: chosen.map((d) => d.title ?? ""),
    levels: chosen.map((d) => d.level),
    search: location.search,
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
