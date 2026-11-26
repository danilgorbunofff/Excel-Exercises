// Why this exists: a short spotlight tour of the exercise page. It opens by
// itself once, on a new visitor's first exercise (no progress yet), and the
// How it works button replays it. The page dims, a cutout moves from part to part and a
// card explains each one. Nothing here is needed to solve an exercise.
import { readProgress } from "./progress.ts";

export const TOUR_KEY = "formula-practice:tour:v1";

interface Stop {
  /** Searched inside the open screen first, then the whole exercise. */
  target: string;
  title: string;
  body: string;
}

const STOPS: Stop[] = [
  {
    target: ".task",
    title: "Read the task",
    body: "It says which cell to fill and what the result should be.",
  },
  {
    target: "[data-grid-wrap]",
    title: "The sheet",
    body: "The data sits here, laid out like a workbook in Excel.",
  },
  {
    target: "[data-form]",
    title: "Write your formula",
    body: "Type a formula here, starting with =. Press Enter to check it.",
  },
  {
    target: "[data-check]",
    title: "Check your answer",
    body: "If the formula is wrong, the message says what is off.",
  },
  {
    target: ".note-hints",
    title: "Stuck?",
    body: "Open a hint for a nudge. The last hint shows the answer, and a solve after it counts as solved with help.",
  },
  {
    target: "[data-tour-start]",
    title: "See this again",
    body: "Press this button at any time to replay this guide.",
  },
];

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function seen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) !== null;
  } catch {
    return true; // Blocked storage: never open by itself, or it would open on every page.
  }
}
function markSeen() {
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {
    // Blocked storage: the How it works button still works.
  }
}

const visible = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement && el.getClientRects().length > 0 && !el.closest("[hidden]");

function find(root: HTMLElement, selector: string): HTMLElement | null {
  const screen = root.querySelector("[data-screen]:not([hidden])");
  const inScreen = screen?.querySelector(selector) ?? null;
  if (visible(inScreen)) return inScreen;
  const anywhere = root.querySelector(selector);
  return visible(anywhere) ? anywhere : null;
}

let close: (() => void) | null = null;

export function startTour(root: HTMLElement): void {
  close?.();
  const stops = STOPS.map((s) => ({ ...s, el: find(root, s.target) })).filter(
    (s): s is Stop & { el: HTMLElement } => s.el !== null,
  );
  if (stops.length === 0) return;
  markSeen();
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const spot = document.createElement("div");
  spot.className = "tour-spot";
  spot.setAttribute("aria-hidden", "true");
  const card = document.createElement("div");
  card.className = "tour-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-labelledby", "tour-title");
  card.setAttribute("aria-describedby", "tour-body");
  card.innerHTML = `
    <p class="tour-count" data-count></p>
    <h2 class="tour-title" id="tour-title"></h2>
    <p class="tour-body" id="tour-body"></p>
    <div class="tour-actions">
      <button type="button" class="link-button tour-skip" data-skip>Skip tour</button>
      <span class="tour-nav">
        <button type="button" class="button button-secondary" data-back>Back</button>
        <button type="button" class="button button-primary" data-next>Next</button>
      </span>
    </div>`;
  document.body.append(spot, card);

  const q = <T extends HTMLElement>(sel: string) => card.querySelector(sel) as T;
  const count = q<HTMLElement>("[data-count]");
  const title = q<HTMLElement>("#tour-title");
  const body = q<HTMLElement>("#tour-body");
  const prev = q<HTMLButtonElement>("[data-back]");
  const next = q<HTMLButtonElement>("[data-next]");
  let i = 0;
  let frame = 0;

  const place = () => {
    const stop = stops[i];
    if (!stop) return;
    const r = stop.el.getBoundingClientRect();
    const pad = 6;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    // Clip the cutout to the viewport, so a tall target never hides the card.
    const top = Math.max(r.top - pad, 4);
    const bottom = Math.min(r.bottom + pad, vh - 4);
    Object.assign(spot.style, {
      top: `${top}px`,
      left: `${Math.max(r.left - pad, 4)}px`,
      width: `${Math.min(r.right + pad, vw - 4) - Math.max(r.left - pad, 4)}px`,
      height: `${Math.max(bottom - top, 0)}px`,
    });
    const gap = 12;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    let y = bottom + gap;
    if (y + ch > vh - 8) y = top - gap - ch;
    if (y < 8) y = vh - ch - 16; // No room on either side: pin to the bottom.
    const x = Math.min(Math.max(r.left + r.width / 2 - cw / 2, 8), vw - cw - 8);
    card.style.top = `${y}px`;
    card.style.left = `${x}px`;
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  };

  const show = (n: number) => {
    const stop = stops[n];
    if (!stop) return end();
    i = n;
    count.textContent = `${n + 1} of ${stops.length}`;
    title.textContent = stop.title;
    body.textContent = stop.body;
    prev.hidden = n === 0;
    next.textContent = n === stops.length - 1 ? "Done" : "Next";
    stop.el.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
    place();
    next.focus({ preventScroll: true });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") end();
    else if (e.key === "ArrowRight" && card.contains(document.activeElement)) show(i + 1);
    else if (e.key === "ArrowLeft" && card.contains(document.activeElement) && i > 0) show(i - 1);
  };

  function end() {
    cancelAnimationFrame(frame);
    removeEventListener("scroll", schedule, true);
    removeEventListener("resize", schedule);
    document.removeEventListener("keydown", onKey);
    spot.remove();
    card.remove();
    close = null;
    back?.focus({ preventScroll: true });
  }
  close = end;

  next.addEventListener("click", () => show(i + 1));
  prev.addEventListener("click", () => show(i - 1));
  q<HTMLButtonElement>("[data-skip]").addEventListener("click", end);
  addEventListener("scroll", schedule, { capture: true, passive: true });
  addEventListener("resize", schedule);
  document.addEventListener("keydown", onKey);
  show(0);
}

const root = document.querySelector<HTMLElement>("[data-exercise]");
const button = document.querySelector<HTMLButtonElement>("[data-tour-start]");
if (root && button) {
  button.hidden = false;
  button.addEventListener("click", () => startTour(root));
  const offer = () => {
    if (!seen() && Object.keys(readProgress()).length === 0) {
      // After fonts settle, so the cutout lands on the final layout.
      void (document.fonts?.ready ?? Promise.resolve()).then(() => startTour(root));
    }
  };
  // A PRO exercise has nothing to explain until it opens; the button stays hidden till then.
  if (root.dataset["locked"] === undefined) offer();
  else root.addEventListener("exercise-unlock", offer, { once: true });
}
