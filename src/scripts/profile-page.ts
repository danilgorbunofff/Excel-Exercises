// Why this exists: fills the profile page: plan, counts and the next exercise.
// It runs again when session.ts has merged the account's progress in.
import { isDue, readProgress } from "./progress.ts";
import { loadMe, SYNCED_EVENT } from "./session.ts";

interface Item {
  id: string;
  title: string;
  href: string;
}

const node = document.querySelector("script[data-exercises]");
const items: Item[] = node?.textContent ? JSON.parse(node.textContent) : [];

function paint(): void {
  const progress = readProgress();
  const solved = items.filter((i) => ["solved", "helped"].includes(progress[i.id]?.state ?? ""));
  const counts = {
    solved: solved.length,
    helped: solved.filter((i) => progress[i.id]?.state === "helped").length,
    due: solved.filter((i) => {
      const e = progress[i.id];
      return e ? isDue(e) : false;
    }).length,
  };
  for (const [k, v] of Object.entries(counts)) {
    const el = document.querySelector(`[data-stat="${k}"]`);
    if (el) el.textContent = String(v);
  }
  const next = items.find((i) => !solved.includes(i));
  const line = document.querySelector<HTMLElement>("[data-next]");
  if (line && solved.length > 0) {
    if (next) {
      const a = document.createElement("a");
      a.href = next.href;
      a.textContent = next.title;
      line.replaceChildren("Next up: ", a, ".");
    } else {
      line.textContent = "You have solved every exercise.";
    }
  }
}

paint();
document.addEventListener(SYNCED_EVENT, paint);

void loadMe().then((me) => {
  if (!me) return;
  const badge = document.querySelector<HTMLElement>("[data-plan]");
  if (badge) badge.hidden = !me.pro;
  const upgrade = document.querySelector<HTMLElement>("[data-upgrade]");
  if (upgrade) upgrade.hidden = me.pro;
});
