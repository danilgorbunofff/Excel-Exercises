// Why this exists: runs a mock assessment. It keeps the formulas and the clock
// in sessionStorage so a reload loses nothing, marks every task only at the
// end with the same grader and wording as the exercises, shows each answer in
// the review, scores each function, and saves the result for a signed-in
// visitor. It never touches practice progress.
import type { Segment } from "../lib/rich-text.ts";
import { byFunction, scoreAttempt, type TaskData } from "./assessment-score.ts";
import { offerCertificate, type Saved } from "./certificate-offer.ts";
import { loadMe, signedIn } from "./session.ts";
import { track } from "./track.ts";
import { verdictView } from "./view.ts";

interface SetData {
  slug: string;
  minutes: number;
  sample: boolean;
  tasks: TaskData[];
}
interface State {
  startedAt: string;
  /** Epoch ms when time runs out, or null when untimed. */
  deadline: number | null;
  formulas: string[];
  index: number;
  finishedAt?: string;
  saved?: boolean;
  /** The server's signed start time, for a timed run by a signed-in visitor. */
  startToken?: string;
  /** What the server saved and marked. */
  result?: Saved;
}
type Result = ReturnType<typeof scoreAttempt>[number];

/** The catalogue filtered to one function, as exercisesForFunction in lib/exercises.ts builds it. */
const exercisesForFunction = (name: string) => `/exercises/?fn=${encodeURIComponent(name)}`;

function paragraph(segments: readonly Segment[], className = ""): HTMLParagraphElement {
  const p = document.createElement("p");
  if (className) p.className = className;
  for (const s of segments) {
    if (s.kind === "text") p.append(s.text);
    else {
      const el = document.createElement(s.kind === "code" ? "code" : "strong");
      el.textContent = s.text;
      p.append(el);
    }
  }
  return p;
}

const pad = (n: number) => String(n).padStart(2, "0");
const clockText = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};

/**
 * Settles once the finished attempt is saved (or saving failed). A held-out
 * task's answer is given only after its set is saved, so the review waits.
 */
let attemptSaved: Promise<unknown> = Promise.resolve();

/** The answer line of a review row. A PRO exercise's answer is asked for only now. */
async function answerLine(task: TaskData): Promise<HTMLParagraphElement> {
  let answer = task.answer;
  if (answer === null) {
    await attemptSaved;
    try {
      const res = await fetch(`/api/exercises/${encodeURIComponent(task.slug)}/`, {
        credentials: "same-origin",
      });
      if (res.ok)
        answer = ((await res.json()) as { answers: string[] }).answers[task.screen] ?? null;
    } catch {
      // Offline or signed out: the link below still leads to the exercise.
    }
  }
  if (answer)
    return paragraph(
      [
        { kind: "text", text: "Answer: " },
        { kind: "code", text: answer },
      ],
      "answer",
    );
  const p = paragraph([{ kind: "text", text: "Open the exercise to see the answer: " }], "answer");
  const a = document.createElement("a");
  a.href = task.href;
  a.textContent = task.title;
  p.append(a, ".");
  return p;
}

/** One answer in the review: the task, the formula and its mark, and under a
 *  miss or a blank a button that opens the reason and the answer. */
function resultItem(r: Result, i: number, open: boolean): HTMLLIElement {
  const state = r.correct ? "correct" : r.formula ? "miss" : "blank";
  const li = document.createElement("li");
  li.className = `a-item ${state}`;
  li.id = `answer-${i + 1}`;
  const num = document.createElement("span");
  num.className = "num";
  num.textContent = String(i + 1);
  const body = document.createElement("div");
  body.className = "body";
  const title = document.createElement("a");
  title.className = "title";
  title.href = r.task.href;
  title.textContent = r.task.title;
  const formula = document.createElement("p");
  formula.className = "line";
  if (r.formula) {
    const code = document.createElement("code");
    code.textContent = r.formula;
    formula.append(code);
  } else formula.textContent = "No answer";
  body.append(title, formula);
  const tag = document.createElement("span");
  tag.className = `mark-tag ${state}`;
  tag.textContent = r.correct ? "Correct" : r.formula ? "Missed" : "Blank";
  li.append(num, body, tag);
  if (r.correct) return li;

  const why = document.createElement("div");
  why.className = "why";
  why.id = `why-${i + 1}`;
  why.hidden = !open;
  if (r.verdict) {
    const valueAt = (address: string) => {
      const m = /^([A-Z]+)(\d+)$/u.exec(address);
      if (!m) return null;
      const col = [...(m[1] ?? "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
      return r.task.spec.rows[Number(m[2]) - 1]?.[col - 1] ?? null;
    };
    const view = verdictView(r.verdict, r.task.spec.answerCell, r.task.misses, valueAt);
    why.append(
      paragraph([{ kind: "cell", text: view.label }, { kind: "text", text: " " }, ...view.message]),
    );
    if (view.miss.length > 0) why.append(paragraph(view.miss));
    if (view.reads.length > 0) why.append(paragraph(view.reads));
  } else {
    why.append(
      paragraph([
        { kind: "text", text: `Left blank. The answer goes in ${r.task.spec.answerCell}.` },
      ]),
    );
  }
  // The answer is filled in when the reason is first opened.
  let filled = false;
  const fill = () => {
    if (filled) return;
    filled = true;
    void answerLine(r.task).then((p) => why.append(p));
  };
  if (open) fill();

  const button = document.createElement("button");
  button.type = "button";
  button.className = "toggle";
  button.textContent = r.formula ? "Why it was missed" : "See the answer";
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-controls", why.id);
  button.addEventListener("click", () => {
    why.hidden = !why.hidden;
    button.setAttribute("aria-expanded", String(!why.hidden));
    if (!why.hidden) fill();
  });
  body.append(button, why);
  return li;
}

/** The by-function table: weakest first, with a practice link where something was missed. */
function functionRows(results: readonly Result[]): HTMLTableRowElement[] {
  return byFunction(results).map((s) => {
    const tr = document.createElement("tr");
    if (s.correct < s.total) tr.className = "weak";
    const name = document.createElement("td");
    if (s.name === "References") name.textContent = "Cell references and arithmetic";
    else {
      const code = document.createElement("code");
      code.textContent = s.name;
      name.append(code);
    }
    const score = document.createElement("td");
    score.className = "score";
    score.textContent = `${s.correct} of ${s.total}`;
    // The share right, as a bar. The numbers beside it say the same in words.
    const barCell = document.createElement("td");
    const bar = document.createElement("div");
    bar.className = "progress-bar bar";
    bar.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.style.width = `${Math.round((s.correct / s.total) * 100)}%`;
    bar.append(fill);
    barCell.append(bar);
    const action = document.createElement("td");
    if (s.correct < s.total) {
      const a = document.createElement("a");
      a.href =
        s.name === "References" ? "/exercises/tracks/references/" : exercisesForFunction(s.name);
      a.textContent = "Practise";
      a.setAttribute(
        "aria-label",
        `Practise ${s.name === "References" ? "cell references" : s.name}`,
      );
      action.append(a);
    }
    tr.append(name, score, barCell, action);
    return tr;
  });
}

function run(root: HTMLElement, data: SetData) {
  const key = `formula-practice:assessment:${data.slug}`;
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
  const stages = {
    intro: q<HTMLElement>('[data-stage="intro"]'),
    test: q<HTMLElement>('[data-stage="test"]'),
    summary: q<HTMLElement>('[data-stage="summary"]'),
  };
  const start = q<HTMLButtonElement>("[data-start]");
  const untimed = q<HTMLInputElement>("[data-untimed]");
  const answered = q<HTMLElement>("[data-answered]");
  const clock = q<HTMLElement>("[data-clock]");
  const clockBox = q<HTMLElement>("[data-clock-box]");
  const alert = q<HTMLElement>("[data-clock-alert]");
  const confirm = q<HTMLElement>("[data-confirm]");
  const finish = q<HTMLButtonElement>("[data-finish]");
  const sections = [...root.querySelectorAll<HTMLElement>("[data-task]")];
  const gotos = [...root.querySelectorAll<HTMLButtonElement>("[data-goto]")];
  const inputs = sections.map((s) => s.querySelector<HTMLInputElement>("[data-input]"));
  if (!stages.intro || !stages.test || !stages.summary || !start || !clock || !finish) return;

  let state: State | null = null;
  let timer = 0;
  const read = (): State | null => {
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? "null") as State | null;
    } catch {
      return null;
    }
  };
  const save = () => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Blocked storage: the attempt still runs, but a reload starts it again.
    }
  };
  const show = (stage: keyof typeof stages) => {
    for (const [name, el] of Object.entries(stages)) if (el) el.hidden = name !== stage;
  };

  const markList = () => {
    let done = 0;
    for (const [i, b] of gotos.entries()) {
      const isDone = (state?.formulas[i] ?? "").trim() !== "";
      if (isDone) done += 1;
      b.classList.toggle("done", isDone);
      b.setAttribute("aria-label", `Task ${i + 1}, ${isDone ? "answered" : "blank"}`);
      if (i === state?.index) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    }
    if (answered) answered.textContent = `${done} of ${sections.length} answered`;
  };
  const goTo = (i: number, focus = true) => {
    if (!state) return;
    state.index = Math.max(0, Math.min(sections.length - 1, i));
    save();
    for (const [n, s] of sections.entries()) s.classList.toggle("off", n !== state.index);
    if (confirm) confirm.textContent = "";
    finish.textContent = "Finish";
    delete finish.dataset["confirm"];
    markList();
    if (focus) inputs[state.index]?.focus();
  };

  const tick = () => {
    if (!state || state.deadline === null) return;
    const left = state.deadline - Date.now();
    clock.textContent = clockText(left);
    clockBox?.classList.toggle("low", left <= 60_000);
    clockBox?.classList.toggle("warn", left > 60_000 && left <= 300_000);
    const s = Math.ceil(left / 1000);
    if (alert && (s === 300 || s === 60))
      alert.textContent = `${s / 60} minute${s === 60 ? "" : "s"} left.`;
    if (left <= 0) end();
  };

  /** The save line: a plain sentence, or one with Log in and Sign up links. */
  const saveNote = (text: "saved" | "signed-out" | "failed") => {
    const note = q<HTMLElement>("[data-save-note]");
    if (!note) return;
    if (text === "saved") note.textContent = "Saved to your history.";
    else if (text === "failed") note.textContent = "Not saved. Reload this page to try again.";
    else {
      const login = document.createElement("a");
      login.href = `/login/?next=${encodeURIComponent(location.pathname)}`;
      login.textContent = "Log in";
      const signup = document.createElement("a");
      signup.href = "/register/";
      signup.textContent = "sign up";
      note.replaceChildren("Not saved. ", login, " or ", signup, " to keep your results.");
    }
  };

  const render = () => {
    if (!state?.finishedAt) return;
    const results = scoreAttempt(state.formulas, data.tasks);
    // Saving starts first: the review rows below wait for it before asking for answers.
    attemptSaved = report(results);
    const marks = results.map((r) => (r.correct ? "correct" : r.formula ? "miss" : "blank"));
    const count = (m: string) => marks.filter((x) => x === m).length;
    const score = q<HTMLElement>("[data-score]");
    const time = q<HTMLElement>("[data-time]");
    if (score) score.textContent = `${count("correct")} of ${results.length} correct`;
    for (const m of ["correct", "miss", "blank"]) {
      const dd = q<HTMLElement>(`[data-count="${m}"]`);
      if (dd) dd.textContent = String(count(m));
    }
    const used = Date.parse(state.finishedAt) - Date.parse(state.startedAt);
    if (time)
      time.textContent =
        state.deadline === null
          ? `${clockText(used)}, untimed`
          : `${clockText(Math.min(used, data.minutes * 60_000))} of ${data.minutes}:00`;
    // One segment per task, in order; the counts under the bar are its key.
    q<HTMLElement>("[data-bar]")?.replaceChildren(
      ...marks.map((m) => {
        const span = document.createElement("span");
        span.className = m;
        return span;
      }),
    );
    const firstMiss = results.findIndex((r) => !r.correct);
    q<HTMLElement>("[data-results]")?.replaceChildren(
      ...results.map((r, i) => resultItem(r, i, i === firstMiss)),
    );
    q<HTMLElement>("[data-by-function]")?.replaceChildren(...functionRows(results));

    // Practise next: each exercise that was missed or left blank, once.
    const missed = [
      ...new Map(results.filter((r) => !r.correct).map((r) => [r.task.href, r.task])).values(),
    ];
    const list = q<HTMLElement>("[data-practise]");
    const head = q<HTMLElement>("[data-practise-head]");
    if (list && head) {
      list.replaceChildren(
        ...missed.map((t) => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = t.href;
          a.textContent = t.title;
          li.append(a);
          return li;
        }),
      );
      list.hidden = head.hidden = missed.length === 0;
    }
    show("summary");
  };

  interface Past {
    assessment: string;
    finished_at: string;
    score: number;
    total: number;
  }
  /** "Your best before", from the earlier attempts at this set. */
  const showBest = (rows: readonly Past[]) => {
    const line = q<HTMLElement>("[data-best]");
    const earlier = rows.filter(
      (r) =>
        r.assessment === data.slug &&
        Date.parse(r.finished_at) !== Date.parse(state?.finishedAt ?? ""),
    );
    if (!line || earlier.length === 0) return;
    const best = earlier.reduce((a, b) => (b.score / b.total > a.score / a.total ? b : a));
    line.textContent = `${best.score} of ${best.total}`;
    const row = q<HTMLElement>("[data-best-row]");
    if (row) row.hidden = false;
  };

  const report = async (results: readonly Result[]) => {
    if (!state?.finishedAt) return;
    const saveOffer = q<HTMLElement>("[data-save-offer]");
    if (!signedIn()) {
      // The sample's Save card has the sign-up links, so the line above stays short.
      if (saveOffer) {
        saveOffer.hidden = false;
        const note = q<HTMLElement>("[data-save-note]");
        if (note) note.textContent = "Not saved yet.";
      } else saveNote("signed-out");
      return;
    }
    // A PRO account needs neither offer.
    void loadMe().then((me) => {
      if (me?.pro) q<HTMLElement>("[data-offers]")?.remove();
    });
    try {
      const past = await fetch("/api/assessments/", { credentials: "same-origin" });
      if (past.ok) showBest((await past.json()) as Past[]);
    } catch {
      // No history line; the result itself is unaffected.
    }
    const offer = () => {
      const box = q<HTMLElement>("[data-cert]");
      if (box && state?.result)
        void offerCertificate(box, {
          slug: data.slug,
          sample: data.sample,
          timed: state.deadline !== null,
          saved: state.result,
        });
    };
    if (state.saved) {
      saveNote("saved");
      offer();
      return;
    }
    try {
      const res = await fetch("/api/assessments/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment: data.slug,
          startedAt: state.startedAt,
          finishedAt: state.finishedAt,
          timeLimit: state.deadline === null ? null : data.minutes * 60,
          // The server marks these itself; the marks shown here are not sent.
          formulas: results.map((r) => r.formula),
          startToken: state.startToken ?? null,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as Saved;
      state.saved = true;
      state.result = { id: body.id, score: body.score, total: body.total };
      save();
      saveNote("saved");
      offer();
    } catch {
      saveNote("failed");
    }
  };

  function end() {
    if (!state || state.finishedAt) return;
    window.clearInterval(timer);
    const now = Date.now();
    const at = state.deadline !== null ? Math.min(now, state.deadline) : now;
    state.finishedAt = new Date(at).toISOString();
    save();
    track("mock_finish");
    render();
    q<HTMLElement>("#summary-title")?.focus();
  }

  const begin = () => {
    if (!state) return;
    show("test");
    for (const [i, input] of inputs.entries()) if (input) input.value = state.formulas[i] ?? "";
    if (clockBox) clockBox.hidden = state.deadline === null;
    if (state.deadline !== null) {
      tick();
      timer = window.setInterval(tick, 1000);
    }
    goTo(state.index);
  };

  // Wiring.
  start.disabled = false;
  start.addEventListener("click", () => {
    track("mock_start");
    state = {
      startedAt: new Date().toISOString(),
      deadline: untimed?.checked ? null : Date.now() + data.minutes * 60_000,
      formulas: data.tasks.map(() => ""),
      index: 0,
    };
    save();
    begin();
    // A timed run gets the server's start time, which a certificate rests on.
    if (signedIn() && state.deadline !== null) {
      const run = state;
      void fetch("/api/assessments/start/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessment: data.slug }),
      })
        .then((r) => (r.ok ? (r.json() as Promise<{ token: string }>) : null))
        .then((t) => {
          if (t && state === run) {
            run.startToken = t.token;
            save();
          }
        })
        .catch(() => {
          // No token: the result still saves, without a certificate.
        });
    }
  });
  for (const [i, section] of sections.entries()) {
    const form = section.querySelector<HTMLFormElement>("[data-form]");
    const input = inputs[i];
    const saved = section.querySelector<HTMLElement>("[data-saved]");
    input?.addEventListener("input", () => {
      if (!state) return;
      state.formulas[i] = input.value;
      save();
      markList();
    });
    // Enter in the formula bar and the Save button both submit this form.
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!state || !input) return;
      state.formulas[i] = input.value.trim();
      save();
      if (saved)
        saved.textContent = state.formulas[i]
          ? "Saved. You can change it until you finish."
          : "Left blank for now.";
      if (i < sections.length - 1) goTo(i + 1);
      else {
        markList();
        finish.focus();
      }
    });
    section
      .querySelector<HTMLButtonElement>("[data-prev]")
      ?.addEventListener("click", () => goTo(i - 1));
    section
      .querySelector<HTMLButtonElement>("[data-next]")
      ?.addEventListener("click", () => goTo(i + 1));
  }
  for (const [i, b] of gotos.entries()) b.addEventListener("click", () => goTo(i));
  finish.addEventListener("click", () => {
    if (!state) return;
    const blank = state.formulas.filter((f) => f.trim() === "").length;
    if (blank > 0 && finish.dataset["confirm"] !== "1") {
      finish.dataset["confirm"] = "1";
      finish.textContent = `Finish with ${blank} blank`;
      if (confirm)
        confirm.textContent = `${blank} task${blank === 1 ? " is" : "s are"} blank and will count as missed. Select Finish again to end.`;
      return;
    }
    end();
  });
  q<HTMLButtonElement>("[data-again]")?.addEventListener("click", () => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Nothing stored.
    }
    location.reload();
  });

  // A reload picks up where the visitor was.
  state = read();
  if (state?.finishedAt) render();
  else if (state) {
    if (state.deadline !== null && state.deadline <= Date.now()) end();
    else begin();
  }
}

const root = document.querySelector<HTMLElement>("[data-assessment]");
const raw = document.querySelector("script[data-assessment-data]")?.textContent;
if (root && raw) {
  const data = JSON.parse(raw) as SetData;
  if (root.dataset["locked"] === undefined) run(root, data);
  else {
    // A PRO set opens once /api/me/ says the visitor has PRO.
    void loadMe().then((me) => {
      const text = root.querySelector<HTMLElement>("[data-paywall-text]");
      if (me && !me.pro && text)
        text.textContent =
          "Your plan is Free. Get PRO to take this assessment, or try the free sample.";
      if (!me?.pro) return;
      root.querySelector("[data-paywall]")?.remove();
      delete root.dataset["locked"];
      run(root, data);
    });
  }
}
