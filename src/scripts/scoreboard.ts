// Why this exists: fills the scoreboard on Home from /api/scoreboard/: six rows
// for the week or for all time, with the learner among them when they rank that
// high and pinned under them when they do not.
// Signed out, or signed in without a nickname, a line under the board says how
// to join. The page has no board when this finds none.

import { boardRows, POINTS_EVENT } from "../lib/points.ts";
import type { Scoreboard } from "../pages/api/scoreboard.ts";
import { signedIn } from "./session.ts";

const board = document.querySelector<HTMLElement>("[data-board]");
const rows = board?.querySelector<HTMLElement>("[data-board-rows]");
const meBody = board?.querySelector<HTMLElement>("[data-board-me]");
const template = board?.querySelector<HTMLTemplateElement>("template[data-board-row]");
const empty = board?.querySelector<HTMLElement>("[data-board-empty]");
const note = board?.querySelector<HTMLElement>("[data-board-note]");
const buttons = [...(board?.querySelectorAll<HTMLButtonElement>("[data-board-period]") ?? [])];

const fmt = (n: number) => n.toLocaleString("en-GB");
const levelLine = (l: Scoreboard["top"][number]["level"]) => `Level ${l.level}, ${l.title}`;

function link(text: string, href: string): HTMLAnchorElement {
  return Object.assign(document.createElement("a"), { href, textContent: text });
}

function paintNote(me: Scoreboard["me"]): void {
  if (!note) return;
  note.hidden = false;
  if (!me) {
    note.replaceChildren(
      link("Create a free account", "/register/"),
      " to earn points and join the scoreboard.",
    );
  } else if (!me.nickname) {
    note.replaceChildren(
      "Only you see your row. ",
      link("Choose a nickname", "/account/settings/#nickname"),
      " to appear for everyone.",
    );
  } else {
    note.hidden = true;
  }
}

function set(root: ParentNode, selector: string, text: string): void {
  const el = root.querySelector(selector);
  if (el) el.textContent = text;
}

function medal(el: HTMLElement | null, rank: number | null): void {
  if (!el) return;
  el.textContent = rank === null ? "-" : String(rank);
  el.dataset["rank"] = el.textContent;
}

function paint(data: Scoreboard): void {
  if (!board || !rows || !template || !meBody) return;
  const me = data.me;
  const list = boardRows(data.top, me);
  rows.replaceChildren(
    ...list.rows.map(({ mine, ...r }) => {
      const tr = template.content.firstElementChild?.cloneNode(true) as HTMLTableRowElement;
      medal(tr.querySelector(".h-medal"), r.rank);
      set(tr, ".h-ava", (r.nickname || "You").charAt(0).toUpperCase());
      set(tr, ".h-name", mine ? "You" : r.nickname);
      set(tr, ".h-meta", levelLine(r.level));
      set(tr, ".h-pts span", fmt(r.points));
      if (mine) tr.classList.add("h-you");
      return tr;
    }),
  );
  meBody.hidden = !list.pinned;
  if (me) {
    medal(meBody.querySelector("[data-me-rank]"), me.rank);
    set(meBody, "[data-me-points]", fmt(me.points));
    set(meBody, "[data-me-level]", levelLine(me.level));
  }
  if (empty) {
    empty.hidden = data.top.length > 0 || Boolean(me && me.points > 0);
    empty.textContent =
      data.period === "week"
        ? "No points yet this week. Solve an exercise to be first."
        : "No one is on the scoreboard yet. Solve an exercise to be first.";
  }
  paintNote(me);
}

async function load(period: "week" | "all"): Promise<void> {
  for (const b of buttons)
    b.setAttribute("aria-pressed", String(b.dataset["boardPeriod"] === period));
  try {
    const res = await fetch(`/api/scoreboard/?period=${period}`);
    if (!res.ok) throw new Error(String(res.status));
    paint((await res.json()) as Scoreboard);
  } catch {
    if (empty) {
      empty.hidden = false;
      empty.textContent = "The scoreboard could not load. Try again later.";
    }
    if (!signedIn()) paintNote(null);
  }
}

if (board) {
  let period: "week" | "all" = "week";
  for (const b of buttons) {
    b.addEventListener("click", () => {
      period = b.dataset["boardPeriod"] === "all" ? "all" : "week";
      void load(period);
    });
  }
  void load(period);
  document.addEventListener(POINTS_EVENT, () => void load(period));
}
