// Why this exists: runs a function drill session. It reads the choice from the
// address, fetches each drill's workbench from /exercises/drills/task/, opens
// it for PRO through locked-exercise.ts and moves on when the drill is solved
// or skipped. At the end it lists the functions that needed more than one try.
// Without PRO the first drill stays a locked preview with the paywall above it.
import { type DrillRef, drillQueue } from "../lib/drills.ts";
import { mountExercise } from "./exercise.ts";
import { unlock } from "./locked-exercise.ts";
import { readProgress } from "./progress.ts";
import { track } from "./track.ts";

const root = document.querySelector<HTMLElement>("[data-drills]");
const poolNode = root?.querySelector("script[data-drill-pool]");
const q = <T extends Element>(selector: string) => root?.querySelector<T>(selector) ?? null;

const params = new URLSearchParams(location.search);
const pool: DrillRef[] = poolNode?.textContent ? JSON.parse(poolNode.textContent) : [];
const queue = drillQueue(pool, { fns: params.getAll("fn"), id: params.get("id") });

interface Outcome {
  drill: DrillRef;
  solved: boolean;
  missed: boolean;
}

const misses = (id: string) => readProgress()[id]?.misses ?? 0;

async function load(drill: DrillRef): Promise<HTMLElement | null> {
  const slot = q<HTMLElement>("[data-drill-slot]");
  const current = slot?.querySelector<HTMLElement>("[data-exercise]");
  if (!slot || !current) return null;
  const data = current.querySelector("script[data-exercise-data]")?.textContent ?? "";
  if (data.includes(`"id":${JSON.stringify(drill.id)}`)) return current;
  try {
    const res = await fetch(`/exercises/drills/task/${drill.slug}/`);
    if (!res.ok) return null;
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const fresh = doc.querySelector<HTMLElement>("[data-exercise]");
    if (!fresh) return null;
    const node = document.importNode(fresh, true);
    current.replaceWith(node);
    return node;
  } catch {
    return null;
  }
}

function summary(outcomes: readonly Outcome[]): void {
  const session = q<HTMLElement>("[data-session]");
  const box = q<HTMLElement>("[data-summary]");
  if (!session || !box) return;
  session.hidden = true;
  box.hidden = false;
  const solved = outcomes.filter((o) => o.solved).length;
  const line = q<HTMLElement>("[data-summary-line]");
  if (line)
    line.textContent = `You solved ${solved} of ${outcomes.length} ${outcomes.length === 1 ? "drill" : "drills"}.`;
  const weak = [...new Set(outcomes.filter((o) => o.missed || !o.solved).map((o) => o.drill.fn))];
  const list = q<HTMLUListElement>("[data-missed-list]");
  const wrap = q<HTMLElement>("[data-summary-missed]");
  if (list && wrap) {
    list.replaceChildren(
      ...weak.map((fn) => {
        const li = document.createElement("li");
        li.append(
          Object.assign(document.createElement("a"), {
            href: `/exercises/drills/?fn=${encodeURIComponent(fn)}`,
            textContent: `Drill ${fn} again`,
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
  if (again) again.href = location.pathname + location.search;
  track("drill_finish");
  q<HTMLElement>("#done-title")?.focus();
}

async function run(): Promise<void> {
  const session = q<HTMLElement>("[data-session]");
  const picker = q<HTMLElement>("[data-picker]");
  const title = q<HTMLElement>("[data-session-title]");
  const skip = q<HTMLButtonElement>("[data-skip]");
  const finish = q<HTMLButtonElement>("[data-finish]");
  const error = q<HTMLElement>("[data-drill-error]");
  const paywall = q<HTMLElement>("[data-paywall]");
  if (!session || !picker || !title || !skip || !finish) return;
  picker.hidden = true;
  session.hidden = false;

  const outcomes: Outcome[] = [];
  let index = 0;
  let current: { drill: DrillRef; before: number; solved: boolean } | null = null;

  const close = () => {
    if (!current) return;
    outcomes.push({
      drill: current.drill,
      solved: current.solved,
      missed: misses(current.drill.id) > current.before,
    });
    current = null;
  };
  const advance = () => {
    close();
    index += 1;
    if (index >= queue.length) summary(outcomes);
    else void show();
  };

  const show = async () => {
    const drill = queue[index];
    if (!drill) return;
    title.textContent = `Drill ${index + 1} of ${queue.length}: ${drill.fn}`;
    const node = await load(drill);
    if (!node) {
      if (error) error.hidden = false;
      return;
    }
    if (error) error.hidden = true;
    // Locked until the answers arrive, so a visitor without PRO cannot type into the preview.
    for (const work of node.querySelectorAll<HTMLElement>(".work")) work.inert = true;
    mountExercise(node);
    current = { drill, before: misses(drill.id), solved: false };
    const next = node.querySelector<HTMLAnchorElement>("a[data-next]");
    if (next && index === queue.length - 1) next.textContent = "See your results";
    next?.addEventListener("click", (e) => {
      e.preventDefault();
      advance();
    });
    node.addEventListener("exercise-solved", () => {
      if (current) current.solved = true;
    });
    const opened = await unlock(node);
    if (opened !== "open") {
      // No PRO: the drill stays a preview and the session ends here.
      if (paywall) paywall.hidden = false;
      skip.hidden = finish.hidden = true;
      return;
    }
    if (index === 0) track("drill_start");
    node.querySelector<HTMLInputElement>("[data-input]")?.focus();
  };

  skip.addEventListener("click", advance);
  finish.addEventListener("click", () => {
    close();
    summary(outcomes);
  });
  await show();
}

// The picker: Start needs at least one function ticked.
const picker = q<HTMLFormElement>("[data-picker]");
picker?.addEventListener("submit", (e) => {
  const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
  if (submitter?.name === "fn") return;
  if (!picker.querySelector("input[name=fn]:checked")) {
    e.preventDefault();
    q<HTMLElement>("[data-pick-hint]")?.setAttribute("role", "alert");
    picker.querySelector<HTMLInputElement>("input[name=fn]")?.focus();
  }
});

if (root && queue.length > 0) void run();
