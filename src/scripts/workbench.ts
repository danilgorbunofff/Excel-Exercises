// Why this exists: the parts of the exercise page around the grader: the
// Exercise and Answer tabs, the timer and the panel divider. Each works on its
// own and the page is complete without any of them.
import { clampPane, formatElapsed } from "../lib/workbench.ts";

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Blocked storage: the choice lasts for this page only.
    }
  },
};

// Tabs: arrow keys move between them, as the tab pattern expects.
for (const list of document.querySelectorAll<HTMLElement>("[data-tabs]")) {
  const tabs = [...list.querySelectorAll<HTMLButtonElement>("[role=tab]")];
  const select = (tab: HTMLButtonElement, focus = false) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute("aria-controls") ?? "");
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
    if (tab.dataset["tab"] === "answer") {
      list.closest("[data-exercise]")?.dispatchEvent(new CustomEvent("answer-shown"));
    }
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      const to =
        e.key === "ArrowRight"
          ? tabs[(i + 1) % tabs.length]
          : e.key === "ArrowLeft"
            ? tabs[(i - 1 + tabs.length) % tabs.length]
            : e.key === "Home"
              ? tabs[0]
              : e.key === "End"
                ? tabs.at(-1)
                : undefined;
      if (to) {
        e.preventDefault();
        select(to, true);
      }
    });
  });
}

// Timer.
const TIMER_KEY = "formula-practice:timer-hidden";
for (const timer of document.querySelectorAll<HTMLElement>("[data-timer]")) {
  const text = timer.querySelector<HTMLElement>("[data-timer-text]");
  const toggle = timer.querySelector<HTMLButtonElement>("[data-timer-toggle]");
  const root = timer.closest<HTMLElement>("[data-exercise]");
  if (!text || !toggle || !root) continue;
  let elapsed = 0;
  let since: number | null = null;
  let tick: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  const show = () => {
    text.textContent = formatElapsed(elapsed + (since === null ? 0 : Date.now() - since));
  };
  const run = () => {
    if (stopped || since !== null) return;
    since = Date.now();
    tick = setInterval(show, 1000);
  };
  const pause = () => {
    if (since === null) return;
    elapsed += Date.now() - since;
    since = null;
    clearInterval(tick);
    show();
  };
  root.addEventListener("input", run, { once: true });
  root.addEventListener("exercise-solved", () => {
    pause();
    stopped = true;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
    else if (elapsed > 0 && !stopped) run();
  });
  const label = toggle.querySelector(".visually-hidden");
  const setHidden = (hidden: boolean) => {
    timer.classList.toggle("is-hidden", hidden);
    toggle.setAttribute("aria-pressed", String(hidden));
    if (label) label.textContent = hidden ? "Show the timer" : "Hide the timer";
  };
  setHidden(store.get(TIMER_KEY) === "1");
  toggle.addEventListener("click", () => {
    const hidden = !timer.classList.contains("is-hidden");
    setHidden(hidden);
    store.set(TIMER_KEY, hidden ? "1" : "0");
  });
}

// Divider.
const PANE_KEY = "formula-practice:pane-width";
const divider = document.querySelector<HTMLElement>("[data-divider]");
const main = divider?.closest<HTMLElement>("main");
if (divider && main) {
  const apply = (pct: number) => {
    const v = clampPane(pct);
    main.style.setProperty("--pane", `${v}%`);
    divider.setAttribute("aria-valuenow", String(Math.round(v)));
    return v;
  };
  const saved = Number(store.get(PANE_KEY));
  let current = apply(Number.isFinite(saved) && saved > 0 ? saved : 40);
  const save = () => store.set(PANE_KEY, String(Math.round(current)));
  divider.addEventListener("pointerdown", (e) => {
    divider.setPointerCapture(e.pointerId);
    divider.classList.add("dragging");
    const rect = main.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      current = apply(((ev.clientX - rect.left) / rect.width) * 100);
    };
    const up = () => {
      divider.classList.remove("dragging");
      divider.removeEventListener("pointermove", move);
      save();
    };
    divider.addEventListener("pointermove", move);
    divider.addEventListener("pointerup", up, { once: true });
    divider.addEventListener("pointercancel", up, { once: true });
  });
  divider.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 10 : 2;
    const to =
      e.key === "ArrowLeft"
        ? current - step
        : e.key === "ArrowRight"
          ? current + step
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? 100
              : null;
    if (to === null) return;
    e.preventDefault();
    current = apply(to);
    save();
  });
}

// Completion dialog: opens when the exercise is solved, and closing it hands
// focus to Next in the status bar.
for (const root of document.querySelectorAll<HTMLElement>("[data-exercise]")) {
  const dialog = root.querySelector<HTMLDialogElement>("[data-done-dialog]");
  if (!dialog) continue;
  const statusNext = () =>
    [...root.querySelectorAll<HTMLElement>("[data-next]")].find((n) => !n.hidden);
  root.addEventListener("exercise-solved", () => {
    if (dialog.open) return;
    dialog.showModal();
    // The exercise script focuses Next in the status bar right after this
    // event; focus the dialog's link once that has run.
    setTimeout(() => dialog.querySelector<HTMLElement>("[data-done-next]")?.focus());
  });
  dialog.querySelector("[data-done-close]")?.addEventListener("click", () => dialog.close());
  // WebKit restores focus after the close event, so move it on the next tick.
  dialog.addEventListener("close", () => setTimeout(() => statusNext()?.focus()));
}
