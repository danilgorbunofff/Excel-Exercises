// Why this exists: fills the account Overview: the next exercise, the plan,
// progress by difficulty, this month's numbers and recent activity. It paints
// again when session.ts has merged the account's progress in.
import { planLine } from "../lib/access.ts";
import { currentStreak } from "../lib/daily.ts";
import type { DailyDays } from "./daily-store.ts";
import { syncDaily } from "./daily-sync.ts";
import { type ProfileItem, profileStats } from "./profile-stats.ts";
import { activeDays, localDay, readProgress } from "./progress.ts";
import { dayLabel, recentActivity } from "./recent-activity.ts";
import { loadMe, SYNCED_EVENT } from "./session.ts";

interface Item extends ProfileItem {
  trackTitle: string;
  number: number;
  trackTotal: number;
}
interface Data {
  items: Item[];
  dailyTitles: Record<string, string>;
  setTitles: Record<string, string>;
}
interface AttemptRow {
  assessment: string;
  finished_at: string;
  score: number;
  total: number;
}

const node = document.querySelector("script[data-overview]");
const data: Data = node?.textContent
  ? JSON.parse(node.textContent)
  : { items: [], dailyTitles: {}, setTitles: {} };
const byId = new Map(data.items.map((i) => [i.id, i]));
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);
const text = (s: string, v: string) => {
  const el = $(s);
  if (el) el.textContent = v;
};
let daily: DailyDays = {};
let attempts: AttemptRow[] = [];

function paint(): void {
  const progress = readProgress();
  const today = localDay();
  const s = profileStats(data.items, progress, Object.keys(daily), today);

  const next = s.next as Item | null;
  const link = $<HTMLAnchorElement>("[data-next]");
  const button = $<HTMLAnchorElement>("[data-next-button]");
  if (next && link && button) {
    link.href = button.href = next.href;
    link.textContent = next.title;
    text("[data-next-meta]", `${next.trackTitle}, exercise ${next.number} of ${next.trackTotal}`);
    text("[data-next-label]", s.solved ? "Continue where you left off" : "Start here");
    text("[data-next-verb]", s.solved ? "Resume" : "Start");
  } else if (!next) {
    text("[data-next-label]", "Every exercise is solved");
    text("[data-next-meta]", "Keep it fresh with the review list and the daily exercise.");
  }
  text(
    "[data-daily-line]",
    daily[today] ? "Today's daily exercise is solved" : "Today's daily exercise is waiting",
  );
  text(
    "[data-due-line]",
    s.due
      ? `${s.due} ${s.due === 1 ? "exercise" : "exercises"} due for review`
      : "Nothing due for review",
  );

  text("[data-solved]", String(s.solved));
  text("[data-percent]", `${s.percent}%`);
  const total = data.items.length || 1;
  for (const n of [1, 2, 3]) {
    const t = s.levels.get(n) ?? { solved: 0, total: 0 };
    const seg = $(`[data-seg="${n}"]`);
    if (seg) seg.style.width = `${(t.solved / total) * 100}%`;
    text(`[data-legend="${n}"]`, `${t.solved} of ${t.total}`);
  }

  const month = today.slice(0, 7);
  const days = [...activeDays(progress, Object.keys(daily)).keys()].filter((d) =>
    d.startsWith(month),
  );
  text("[data-fig=days]", String(days.length));
  text("[data-fig=streak]", String(currentStreak(new Set(Object.keys(daily)), today)));
  text("[data-fig=due]", String(s.due));
  text("[data-month-name]", new Date().toLocaleDateString("en-GB", { month: "long" }));

  const rows = recentActivity({
    progress,
    exercises: byId,
    daily,
    dailyTitles: data.dailyTitles,
    attempts,
    setTitles: data.setTitles,
  });
  const body = $("[data-recent]");
  const box = $("[data-recent-box]");
  const empty = $("[data-recent-empty]");
  if (box) box.hidden = rows.length === 0;
  if (empty) empty.hidden = rows.length > 0;
  body?.replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement("tr");
      const title = document.createElement("td");
      if (r.href) {
        const a = Object.assign(document.createElement("a"), {
          href: r.href,
          textContent: r.title,
          className: "row-link",
        });
        title.append(a);
      } else title.textContent = r.title;
      const where = Object.assign(document.createElement("td"), {
        className: "muted",
        textContent: r.where,
      });
      const result = document.createElement("td");
      result.append(
        Object.assign(document.createElement("span"), {
          className: r.good ? "pill ok" : "pill",
          textContent: r.result,
        }),
      );
      const when = Object.assign(document.createElement("td"), {
        className: "r muted tnum nowrap",
        textContent: dayLabel(r.day, today),
      });
      tr.append(title, where, result, when);
      return tr;
    }),
  );
}

paint();
document.addEventListener(SYNCED_EVENT, paint);
void syncDaily().then(({ days }) => {
  daily = days;
  paint();
});

void loadMe().then(async (me) => {
  if (!me) return;
  // Google sign-ups saw no email checkbox: ask once, until answered.
  const ask = $("[data-daily-ask]");
  if (ask) ask.hidden = me.dailyAsked !== false;
  if (me.pro) {
    text("[data-plan-name]", me.proStatus === "lifetime" ? "Lifetime PRO" : "PRO");
    text("[data-plan-line]", planLine(me));
    const tag = $("[data-plan-tag]");
    if (tag) tag.hidden = false;
    const button = $("[data-plan-button]");
    if (button) {
      button.textContent = "View billing";
      button.className = "button button-secondary";
    }
  }
  const [a, c] = await Promise.all([
    fetch("/api/assessments/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch("/api/certificates/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
  ]);
  attempts = Array.isArray(a) ? a : [];
  const certs = Array.isArray(c)
    ? c.filter((x: { revoked_at?: string | null }) => !x.revoked_at)
    : [];
  text("[data-fig=certs]", String(certs.length));
  paint();
});
