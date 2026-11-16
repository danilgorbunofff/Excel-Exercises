// Replays the Excel-checked audit fixtures (tools/write-audit-fixtures.ts) so a
// grader or content change that lets a wrong formula through, or fails a right
// one, breaks `npm run test` without Excel.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { grade } from "@practice/grader";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { type AuditScreen, loadTasks, specOf } from "../../tools/lib/audit-tasks.ts";

const ROOT = "tools/audit/formulas";
const tasks = loadTasks();
const cases = ["exercise", "daily", "mock"].flatMap((kind) =>
  existsSync(`${ROOT}/${kind}`)
    ? readdirSync(`${ROOT}/${kind}`)
        .filter((f) => f.endsWith(".yaml"))
        .flatMap((f) => {
          const id = f.replace(/\.yaml$/u, "");
          const { screens } = parse(readFileSync(`${ROOT}/${kind}/${f}`, "utf8")) as {
            screens: AuditScreen[];
          };
          return screens.map((s, index) => ({ kind, id, index, s }));
        })
    : [],
);

describe("audit fixtures checked in Excel", () => {
  it("cover every screen", () => {
    expect(cases.length).toBe(tasks.length);
  });

  it.each(cases)("$kind/$id screen $index", ({ kind, id, index, s }) => {
    const t = tasks.find((x) => x.kind === kind && x.id === id && x.index === index);
    expect(t, "the screen still exists").toBeDefined();
    if (!t) return;
    const spec = specOf(t.screen);
    for (const f of [...(s.correct ?? []), ...(s.equivalent ?? []).map((e) => e.formula)])
      expect(grade(f, spec), f).toMatchObject({ correct: true });
    for (const w of s.wrong ?? [])
      expect(grade(w.formula, spec), w.formula).toMatchObject({ correct: false, rule: w.rule });
  });
});
