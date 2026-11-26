// Why this exists: opens a PRO exercise for a visitor who has PRO. The page is
// built without the answers; this fetches them from /api/exercises/, fills the
// hint and the Answer tab, removes the paywall and starts the exercise.
// shortcut: the sheet and checks are in the page and only hidden; the answers
// are the part kept on the server. Move the whole sheet behind the API if that
// ever matters.
import { loadMe } from "./session.ts";
import { track } from "./track.ts";

export type UnlockResult = "open" | "free" | "out" | "error";

/** Unlocks one locked exercise root. The drills page calls it for each drill it adds. */
export async function unlock(root: HTMLElement): Promise<UnlockResult> {
  try {
    return await open(root);
  } finally {
    // The paywall card waits for this, so a PRO visitor never sees it flash by.
    root.dataset["checked"] = "";
  }
}

async function open(root: HTMLElement): Promise<UnlockResult> {
  const slug = root.dataset["locked"] ?? "";
  const text = root.querySelector<HTMLElement>("[data-paywall-text]");
  const me = await loadMe();
  // A Free account may hold a drill from today's free run: the server decides.
  const tryFree = !!me && !me.pro && root.dataset["drill"] !== undefined;
  if (!me?.pro && !tryFree) {
    track("paywall_seen");
    if (me && text)
      text.textContent =
        "Your plan is Free. Get PRO to open this exercise and every other PRO one.";
    return me ? "free" : "out";
  }
  const res = await fetch(`/api/exercises/${encodeURIComponent(slug)}/`, {
    credentials: "same-origin",
  }).catch(() => null);
  if (tryFree && res?.status === 403) {
    track("paywall_seen");
    if (text)
      text.textContent =
        "Your plan is Free. Get PRO to open this exercise and every other PRO one.";
    return "free";
  }
  if (!res?.ok) {
    if (text) text.textContent = "This exercise could not be opened. Reload the page to try again.";
    return "error";
  }
  const { answers } = (await res.json()) as { answers: string[] };
  for (const code of root.querySelectorAll<HTMLElement>("[data-answer]")) {
    code.textContent = answers[Number(code.dataset["answer"])] ?? "";
  }
  root.querySelector("[data-paywall]")?.remove();
  for (const work of root.querySelectorAll<HTMLElement>(".work")) work.inert = false;
  delete root.dataset["locked"];
  root.dispatchEvent(new CustomEvent("exercise-unlock", { detail: answers }));
  return "open";
}

// An exercise page: its one locked exercise is in the page from the start.
const root = document.querySelector<HTMLElement>("[data-exercise][data-locked]:not([data-defer])");
if (root) void unlock(root);
