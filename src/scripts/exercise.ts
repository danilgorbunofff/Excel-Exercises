// Why this exists: runs the exercise in the browser. It grades the formula on
// Enter or Check, outlines what the formula read on the grid and in the
// formula text, shows the verdict, turns Check into Next once the answer is
// right, and runs the hint ladder. The page is complete without it.
import { type GradeSpec, grade, type Rule, type Verdict } from "@practice/grader";
import type { Segment } from "../lib/rich-text.ts";
import { readProgress, record } from "./progress.ts";
import { compareWithAnswer, outlineClasses, verdictView } from "./view.ts";

interface ScreenData {
  spec: GradeSpec;
  answer: string;
  misses: Partial<Record<Rule, string>>;
}
interface PageData {
  id: string;
  screens: ScreenData[];
}

const OUTLINE = ["read", "read-top", "read-right", "read-bottom", "read-left"];
/** Excel aligns numbers right, text left, and logical values and errors in the centre. */
const VALUE_KINDS = ["num", "text", "bool", "err", "empty"];
const kindOf = (v: Verdict["value"]) =>
  v === null || v === undefined
    ? "empty"
    : typeof v === "number"
      ? "num"
      : typeof v === "boolean"
        ? "bool"
        : typeof v === "string"
          ? "text"
          : "err";

function append(parent: HTMLElement, segments: readonly Segment[], refClass = "") {
  for (const s of segments) {
    if (s.kind === "text") parent.append(s.text);
    else {
      const el = document.createElement(s.kind === "code" ? "code" : "strong");
      if (s.kind === "code" && refClass) el.className = refClass;
      el.textContent = s.text;
      parent.append(el);
    }
  }
}

function paragraph(segments: readonly Segment[], refClass = ""): HTMLParagraphElement {
  const p = document.createElement("p");
  append(p, segments, refClass);
  return p;
}

const PROGRESS_TEXT = {
  solved: "You solved this exercise.",
  helped: "You solved this exercise with help.",
  revealed: "You have seen the answer to this exercise.",
} as const;

function showProgress(exercise: HTMLElement, id: string) {
  const line = exercise.querySelector<HTMLElement>("[data-progress]");
  const entry = readProgress()[id];
  if (!line || !entry) return;
  line.textContent = PROGRESS_TEXT[entry.state];
  line.hidden = false;
}

function setupScreen(exercise: HTMLElement, page: PageData, index: number, root: HTMLElement) {
  const screen = page.screens[index];
  if (!screen) return;
  const { spec } = screen;
  const q = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const form = q<HTMLFormElement>("[data-form]");
  const input = q<HTMLInputElement>("[data-input]");
  const mirror = q<HTMLElement>("[data-mirror]");
  const wrap = q<HTMLElement>("[data-grid-wrap]");
  const status = q<HTMLElement>("[data-status]");
  const verdictBox = q<HTMLElement>("[data-verdict]");
  const check = q<HTMLButtonElement>("[data-check]");
  const next = q<HTMLElement>("[data-next]");
  const reset = q<HTMLButtonElement>("[data-reset]");
  const hintNext = q<HTMLButtonElement>("[data-hint-next]");
  const hints = exercise.querySelector<HTMLElement>(`[data-hints="${index}"]`);
  if (!form || !input || !mirror || !wrap || !status || !verdictBox || !check || !next || !reset)
    return;

  const width = spec.rows[0]?.length ?? 0;
  const height = spec.rows.length;
  const cells = new Map<string, HTMLTableCellElement>();
  for (const td of root.querySelectorAll<HTMLTableCellElement>("td[data-cell]")) {
    cells.set(td.dataset["cell"] ?? "", td);
  }
  const answerTd = cells.get(spec.answerCell);
  const steps = hints ? [...hints.querySelectorAll<HTMLDetailsElement>("details[data-hint]")] : [];
  const valueAt = (address: string) => {
    const m = /^([A-Z]+)(\d+)$/u.exec(address);
    if (!m) return null;
    const col = [...(m[1] ?? "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
    return spec.rows[Number(m[2]) - 1]?.[col - 1] ?? null;
  };
  const initialVerdict = [...verdictBox.childNodes].map((n) => n.cloneNode(true));
  const answerReads = grade(screen.answer, spec).reads;
  let lastReads: Verdict["reads"] | null = null;
  let checkedFormula: string | null = null;
  let marks: { start: number; end: number; kind: "read" | "miss" }[] = [];

  // A grid wider than the screen scrolls, and a scrolling region must take focus.
  const syncScrollable = () => {
    if (wrap.scrollWidth > wrap.clientWidth) {
      wrap.tabIndex = 0;
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-label", "Sheet, scrolls sideways");
    } else {
      wrap.removeAttribute("tabindex");
      wrap.removeAttribute("role");
      wrap.removeAttribute("aria-label");
    }
  };
  syncScrollable();
  new ResizeObserver(syncScrollable).observe(wrap);

  const drawMirror = () => {
    const value = input.value;
    mirror.replaceChildren();
    const active = value === checkedFormula ? marks : [];
    let at = 0;
    for (const m of [...active].sort((a, b) => a.start - b.start)) {
      if (m.start < at) continue;
      mirror.append(value.slice(at, m.start));
      const mark = document.createElement("mark");
      mark.className = m.kind;
      mark.textContent = value.slice(m.start, m.end);
      mirror.append(mark);
      at = m.end;
    }
    mirror.append(value.slice(at));
    mirror.scrollLeft = input.scrollLeft;
  };

  const clearGrid = () => {
    for (const td of cells.values()) td.classList.remove(...OUTLINE);
    if (answerTd) {
      answerTd.classList.remove("answer-miss", "answer-correct", ...VALUE_KINDS);
      answerTd.classList.add("empty");
      answerTd.textContent = "";
    }
  };

  const updateCompare = () => {
    const out = hints?.querySelector<HTMLElement>("[data-compare]");
    if (!out) return;
    out.textContent = compareWithAnswer(lastReads, answerReads, width, height);
    out.hidden = false;
  };

  const showNext = (on: boolean) => {
    check.hidden = on;
    next.hidden = !on;
    syncHintButton();
  };

  const resetAll = () => {
    input.value = "";
    input.removeAttribute("aria-invalid");
    checkedFormula = null;
    marks = [];
    lastReads = null;
    clearGrid();
    drawMirror();
    status.classList.remove("status-miss", "status-correct");
    verdictBox.replaceChildren(...initialVerdict.map((n) => n.cloneNode(true)));
    showNext(false);
    reset.disabled = true;
    updateCompare();
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formula = input.value.trim();
    reset.disabled = false;
    if (formula === "") {
      status.classList.remove("status-correct");
      status.classList.add("status-miss");
      verdictBox.replaceChildren(
        paragraph([{ kind: "text", text: "Type a formula first. It starts with =." }]),
      );
      input.focus();
      return;
    }
    if (formula !== input.value) input.value = formula;
    const verdict = grade(formula, spec);
    const view = verdictView(verdict, spec.answerCell, screen.misses, valueAt);

    // The grid: outline what was read, and show the result in the answer cell.
    clearGrid();
    for (const [address, classes] of outlineClasses(verdict.reads, width, height)) {
      cells.get(address)?.classList.add(...classes);
    }
    if (answerTd) {
      answerTd.textContent = verdict.display ?? "";
      answerTd.classList.remove("empty");
      answerTd.classList.add(
        kindOf(verdict.value),
        verdict.correct ? "answer-correct" : "answer-miss",
      );
    }

    // The formula text: mark each reference, and the part the verdict is about.
    marks = verdict.reads.map((r) => ({ start: r.start, end: r.end, kind: "read" as const }));
    if (!verdict.correct && verdict.start !== undefined && verdict.end !== undefined) {
      marks = marks.filter((m) => m.end <= (verdict.start ?? 0) || m.start >= (verdict.end ?? 0));
      marks.push({ start: verdict.start, end: verdict.end, kind: "miss" });
    }
    checkedFormula = formula;
    drawMirror();

    // The verdict line.
    const label = document.createElement("strong");
    label.className = "label";
    label.textContent = view.label;
    const first = paragraph(view.message);
    first.prepend(label, " ");
    const lines = [first];
    if (view.miss.length > 0) lines.push(paragraph(view.miss));
    if (view.reads.length > 0) lines.push(paragraph(view.reads, "ref"));
    verdictBox.replaceChildren(...lines);
    status.classList.toggle("status-miss", !verdict.correct);
    status.classList.toggle("status-correct", verdict.correct);
    lastReads = verdict.reads;
    updateCompare();

    if (verdict.correct) {
      input.removeAttribute("aria-invalid");
      if (index === page.screens.length - 1) {
        record(page.id, "solved");
        showProgress(exercise, page.id);
        exercise.dispatchEvent(new CustomEvent("exercise-solved"));
      }
      showNext(true);
      next.focus();
    } else {
      input.setAttribute("aria-invalid", "true");
      showNext(false);
    }
  });

  input.addEventListener("input", () => {
    // A changed formula has not been checked yet: the main action is Check again.
    if (!next.hidden) showNext(false);
    reset.disabled = input.value === "" && checkedFormula === null;
    drawMirror();
  });
  input.addEventListener("scroll", () => {
    mirror.scrollLeft = input.scrollLeft;
  });
  reset.addEventListener("click", () => {
    resetAll();
    input.focus();
  });
  // The task says "Click cell B6": as in Excel, that is where typing starts.
  answerTd?.addEventListener("click", () => input.focus());

  // Multi-screen exercises: Next on a screen shows the following one.
  if (next instanceof HTMLButtonElement) {
    next.addEventListener("click", () => {
      const following = exercise.querySelector<HTMLElement>(`[data-screen="${index + 1}"]`);
      if (!following) return;
      root.hidden = true;
      following.hidden = false;
      for (const p of exercise.querySelectorAll<HTMLElement>("[data-prompt]")) {
        p.hidden = p.dataset["prompt"] !== String(index + 1);
      }
      for (const h of exercise.querySelectorAll<HTMLElement>("[data-hints]")) {
        h.hidden = h.dataset["hints"] !== String(index + 1);
      }
      following.querySelector<HTMLInputElement>("[data-input]")?.focus();
    });
  }

  // The hint ladder.
  function syncHintButton() {
    // Once the answer is right, Next is the only action.
    if (hintNext) hintNext.hidden = !next?.hidden || steps.every((d) => d.open);
  }
  for (const d of steps) {
    d.addEventListener("toggle", () => {
      if (d.open && d.dataset["hint"] === "2") updateCompare();
      if (d.open && d.dataset["hint"] === "3") {
        record(page.id, "revealed");
        showProgress(exercise, page.id);
      }
      syncHintButton();
    });
  }
  hintNext?.addEventListener("click", () => {
    const step = steps.find((d) => !d.open);
    if (!step) return;
    step.open = true;
    step.querySelector("summary")?.focus();
  });
  syncHintButton();
}

// Each exercise on a page has its own root and data, so a page can hold one
// as its main content or embed one, as the home and function pages do.
function start(exercise: HTMLElement, data: PageData): void {
  for (const root of exercise.querySelectorAll<HTMLElement>("[data-screen]")) {
    setupScreen(exercise, data, Number(root.dataset["screen"]), root);
  }
  for (const h of exercise.querySelectorAll<HTMLElement>("[data-hints]")) {
    h.hidden = h.dataset["hints"] !== "0";
  }
  showProgress(exercise, data.id);
  // The Answer tab shows every answer, so it counts as seeing the answer.
  exercise.addEventListener("answer-shown", () => {
    record(data.id, "revealed");
    showProgress(exercise, data.id);
  });
}

for (const exercise of document.querySelectorAll<HTMLElement>("[data-exercise]")) {
  const node = exercise.querySelector("script[data-exercise-data]");
  if (!node?.textContent) continue;
  const data = JSON.parse(node.textContent) as PageData;
  if (exercise.dataset["locked"] === undefined) {
    start(exercise, data);
    continue;
  }
  // A PRO exercise starts once locked-exercise.ts has fetched its answers.
  exercise.addEventListener(
    "exercise-unlock",
    (e) => {
      const answers = (e as CustomEvent<string[]>).detail;
      data.screens.forEach((s, i) => {
        s.answer = answers[i] ?? "";
      });
      start(exercise, data);
    },
    { once: true },
  );
}
