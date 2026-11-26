// Why this exists: the Status column and the track progress bars read the
// same progress store, so every list shows the same state with the same words.
import { exerciseAction, isDone, trackStatus } from "../lib/catalogue.ts";
import { foldSets, type Progress, readProgress } from "./progress.ts";

const LABELS = {
  solved: "Solved",
  helped: "Solved with help",
  revealed: "Answer seen",
  tried: "Tried",
  "": "Not started",
} as const;

/**
 * Fills every [data-status-for] mark and [data-track-progress] bar on the
 * page, with the button label beside each: Start, Continue or Review.
 */
export function paintStatus(progress: Progress = foldSets(readProgress())): void {
  for (const el of document.querySelectorAll<HTMLElement>("[data-status-for]")) {
    const state = progress[el.dataset["statusFor"] ?? ""]?.state ?? "";
    el.dataset["state"] = state;
    const label = el.querySelector<HTMLElement>("[data-status-label]");
    if (label) label.textContent = LABELS[state];
    else el.textContent = state === "revealed" ? "" : state ? LABELS[state] : "";
    const row = el.closest<HTMLElement>("[data-row]");
    row?.setAttribute("data-state", state);
    // The label is written twice: once to see, and once inside the link's
    // hidden name, so the name has no stray space before its colon.
    for (const action of row?.querySelectorAll<HTMLElement>("[data-action-label]") ?? []) {
      action.textContent = exerciseAction(state);
    }
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-track-progress]")) {
    const ids = (el.dataset["trackProgress"] ?? "").split(" ").filter(Boolean);
    const done = ids.filter((id) => isDone(progress[id]?.state ?? "")).length;
    const bar = el.querySelector<HTMLElement>("[data-bar]");
    const text = el.querySelector<HTMLElement>("[data-bar-text]");
    if (bar) bar.style.width = `${ids.length ? (done / ids.length) * 100 : 0}%`;
    if (text) text.textContent = `${done} of ${ids.length} solved`;
    const percent = el.querySelector<HTMLElement>("[data-track-percent]");
    if (percent) percent.textContent = `${ids.length ? Math.round((done / ids.length) * 100) : 0}%`;
    const status = trackStatus(done, ids.length);
    const pill = el.querySelector<HTMLElement>("[data-track-state]");
    if (pill) {
      pill.dataset["state"] = status.state;
      pill.textContent = status.pill;
    }
    for (const action of el.querySelectorAll<HTMLElement>("[data-track-action]")) {
      action.textContent = status.action;
    }
  }
}
