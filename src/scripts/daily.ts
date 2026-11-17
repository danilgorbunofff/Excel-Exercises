// Why this exists: runs the daily page. It works out the visitor's day, puts
// that day's exercise on the page, and counts the streak. A solve of today's
// exercise adds today to the streak; an earlier day is practice only. Signed
// in, the days are merged with the account's and each new one is sent once.
import { type DailyEntry, isDay, LADDER_START, pickFor } from "../lib/daily.ts";
import { readDaily, writeDaily } from "./daily-store.ts";
import { type DailySync, postDaily, syncDaily } from "./daily-sync.ts";
import { longDate, renderStreak } from "./daily-view.ts";
import { mountExercise } from "./exercise.ts";
import { localDay } from "./progress.ts";
import { signedIn } from "./session.ts";
import { track } from "./track.ts";

const q = <T extends Element>(root: Element, selector: string) => root.querySelector<T>(selector);

function start(root: HTMLElement, pool: DailyEntry[]) {
  // The day is fixed when the page opens: a solve just after midnight still
  // counts for the day that was shown.
  const today = localDay();
  const asked = new URLSearchParams(location.search).get("day");
  const day = isDay(asked) && asked >= LADDER_START && asked < today ? asked : today;
  const past = day !== today;
  const pick = pickFor(day, pool);
  let sync: DailySync = { days: readDaily(), server: new Set(), joined: false };

  const render = () => {
    const now = localDay();
    const solved = (d: string) => sync.days[d] !== undefined;
    const date = q<HTMLElement>(root, "[data-date]");
    const state = q<HTMLElement>(root, "[data-state]");
    if (date) date.textContent = longDate(day);
    if (state) {
      state.textContent = past
        ? `This is the exercise for ${longDate(day)}. Earlier days are practice and do not change your streak.`
        : now !== today
          ? "A new day has started. Reload the page for its exercise."
          : solved(today)
            ? "Solved today. A new exercise comes tomorrow."
            : "Not solved yet today.";
    }
    const todayBox = q<HTMLElement>(root, "[data-today]");
    if (todayBox) {
      todayBox.textContent = solved(now) ? "Solved" : "Not yet";
      todayBox.classList.toggle("correct", solved(now));
    }
    renderStreak(root, sync.days, day);
  };

  render();
  void showExercise(root, pick, past, day).then((exercise) => {
    exercise?.addEventListener("exercise-solved", () => {
      if (past || !pick) return;
      track("daily_done");
      sync.days = { ...readDaily(), [day]: pick.id };
      writeDaily(sync.days);
      render();
      // After the join, so a day the join already sent is not sent again.
      if (signedIn())
        void syncDaily().then((joined) => {
          if (!joined.server.has(day)) void postDaily([{ day, exercise: pick.id }], joined);
        });
    });
  });

  // Signed in: join this browser's days with the account's, both ways.
  void syncDaily().then((joined) => {
    // A solve made while the account was loading is kept.
    sync = { ...joined, days: { ...joined.days, ...sync.days } };
    render();
  });
}

/** Puts the day's exercise in the slot, fetching it unless the page already has it. */
async function showExercise(
  root: HTMLElement,
  pick: DailyEntry | null,
  past: boolean,
  day: string,
): Promise<HTMLElement | null> {
  const slot = q<HTMLElement>(root, "[data-task-slot]");
  let exercise = slot ? q<HTMLElement>(slot, "[data-exercise]") : null;
  const fail = () => {
    const error = q<HTMLElement>(root, "[data-task-error]");
    if (error) error.hidden = false;
    return null;
  };
  if (!slot || !exercise || !pick) return fail();
  const data = q<HTMLScriptElement>(exercise, "script[data-exercise-data]")?.textContent ?? "";
  if (!data.includes(`"id":${JSON.stringify(pick.id)}`)) {
    try {
      const res = await fetch(`/daily/task/${pick.slug}/`);
      if (!res.ok) return fail();
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      const fresh = doc.querySelector<HTMLElement>("[data-exercise]");
      if (!fresh) return fail();
      const node = document.importNode(fresh, true);
      exercise.replaceWith(node);
      exercise = node;
    } catch {
      return fail();
    }
  }
  const heading = q<HTMLElement>(exercise, "[data-live-heading]");
  if (heading && past) heading.textContent = `The exercise for ${longDate(day)}`;
  slot.hidden = false;
  mountExercise(exercise);
  return exercise;
}

const page = document.querySelector<HTMLElement>("[data-daily]");
const poolNode = page?.querySelector("script[data-daily-pool]");
if (page && poolNode?.textContent) start(page, JSON.parse(poolNode.textContent) as DailyEntry[]);
