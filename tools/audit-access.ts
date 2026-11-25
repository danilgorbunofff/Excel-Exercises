// Why this exists: Phase 3 of the reverification, run after `npm run build`.
// Checks the free and PRO split per track, then scans dist/client for any PRO
// mock, drill or ladder step reference answer and for daily-only tasks outside /daily/.
// Usage: node tools/audit-access.ts
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { isLocked, topicNumbers } from "../src/lib/access.ts";
import { parentOf } from "../src/lib/steps.ts";
import { loadTasks } from "./lib/audit-tasks.ts";
import { findDailyMentions, findLeaks } from "./lib/leak-scan.ts";

const DIST = "dist/client";
const track = parse(readFileSync("content/track.yaml", "utf8")) as {
  topics: { slug: string; group: string }[];
  order: string[];
};
const tasks = loadTasks();
const topicOf = new Map(
  tasks
    .filter((t) => t.kind === "exercise")
    .map((t) => [t.id, (parse(readFileSync(t.file, "utf8")) as { topic: string }).topic]),
);
const numbers = topicNumbers(track.order, (id) => topicOf.get(id) ?? "");
const problems: string[] = [];

// Free and PRO: the first two of every track, interview tracks included, are free.
for (const topic of track.topics) {
  const ids = track.order.filter((id) => topicOf.get(id) === topic.slug);
  const free = ids.filter((id) => !isLocked({ topicNumber: numbers.get(id) ?? 0 }));
  if (free.join() !== ids.slice(0, 2).join())
    problems.push(
      `track ${topic.slug}: free ${free.join(", ")} but first two are ${ids.slice(0, 2).join(", ")}`,
    );
  console.log(
    `${topic.group.padEnd(10)} ${topic.slug.padEnd(28)} ${ids.length} exercises, free: ${free.join(", ")}`,
  );
}

const pro = tasks.filter(
  (t) =>
    t.kind === "mock" ||
    t.kind === "drill" ||
    (t.kind === "exercise" && isLocked({ topicNumber: numbers.get(t.id) ?? 0 })) ||
    // A ladder step shares its exercise's lock.
    (t.kind === "step" && isLocked({ topicNumber: numbers.get(parentOf(t.id) ?? "") ?? 0 })),
);
const secrets = pro.map((t) => ({
  owner: `${t.kind}/${t.id}#${t.index + 1}`,
  answer: t.screen.answer,
}));
// An answer that is also the answer of a free task or worked example may appear legitimately.
const freeAnswers = new Set(tasks.filter((t) => !pro.includes(t)).map((t) => t.screen.answer));
const leaks = findLeaks(DIST, secrets);
for (const h of leaks)
  problems.push(
    `${freeAnswers.has(h.answer) ? "shared " : "LEAK   "}${h.owner} ${h.answer} in ${h.file}`,
  );

const dailySlugs = [...new Set(tasks.filter((t) => t.kind === "daily").map((t) => t.id))];
for (const h of findDailyMentions(DIST, dailySlugs))
  problems.push(`daily  ${h.owner} named in ${h.file}`);

console.log(
  `\n${secrets.length} PRO, mock and drill answers scanned, ${dailySlugs.length} daily tasks.`,
);
for (const p of problems) console.log(p);
console.log(problems.length ? `${problems.length} problems.` : "No problems.");
process.exitCode = problems.some((p) => !p.startsWith("shared")) ? 1 : 0;
