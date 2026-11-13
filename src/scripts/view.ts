// Why this exists: what the exercise screen shows for a verdict, worked out
// without the DOM so it can be tested: the label naming the rule and the cell,
// the line about what the formula read, the outline of each read range, and
// hint 2's comparison with the answer's ranges. All of it comes from the
// grader's parse tree, never from the verdict text.
import { columnLetters, formatValue, type Rule, type Verdict } from "@practice/grader";
import { describeCells, richText, type Segment } from "../lib/rich-text.ts";

type Read = Verdict["reads"][number];

export const RULE_LABELS: Record<Rule, (cell: string) => string> = {
  syntax: (cell) => `Formula error in ${cell}.`,
  "required-function": (cell) => `Missing function in ${cell}.`,
  "forbidden-function": (cell) => `Function not allowed in ${cell}.`,
  reference: (cell) => `Cell reference problem in ${cell}.`,
  value: (cell) => `Wrong result in ${cell}.`,
};

export interface VerdictView {
  state: "correct" | "miss";
  label: string;
  message: Segment[];
  miss: Segment[];
  reads: Segment[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "3 cells, total 358" for a range, or the value for a single cell. */
function readDetail(read: Read, valueAt: (address: string) => unknown): string {
  if (read.cells === 1) {
    const address = `${columnLetters(read.box.left)}${read.box.top}`;
    const v = valueAt(address);
    return v === null || v === undefined || v === "" ? "empty" : formatValue(v as never);
  }
  const cells = plural(read.cells, "cell", "cells");
  if (read.numbers === 0) return `${cells}, no numbers`;
  const total = `total ${formatValue(read.sum)}`;
  return read.numbers === read.cells
    ? `${cells}, ${total}`
    : `${cells}, ${plural(read.numbers, "number", "numbers")}, ${total}`;
}

/** "Your formula reads B2:B4 (3 cells, total 358), outlined in blue." */
export function readsLine(reads: readonly Read[], valueAt: (a: string) => unknown): Segment[] {
  if (reads.length === 0) return [];
  const out: Segment[] = [{ kind: "text", text: "Your formula reads " }];
  reads.forEach((r, i) => {
    if (i > 0) out.push({ kind: "text", text: i === reads.length - 1 ? " and " : ", " });
    out.push({ kind: "code", text: r.text.toUpperCase().replaceAll("$", "") });
    out.push({ kind: "text", text: ` (${readDetail(r, valueAt)})` });
  });
  out.push({ kind: "text", text: ", outlined in blue." });
  return out;
}

export function verdictView(
  verdict: Verdict,
  answerCell: string,
  misses: Partial<Record<Rule, string>>,
  valueAt: (a: string) => unknown,
): VerdictView {
  if (verdict.correct) {
    return {
      state: "correct",
      label: "Correct.",
      message: richText(verdict.message.replace(/^Correct\.\s*/u, "")),
      miss: [],
      reads: readsLine(verdict.reads, valueAt),
    };
  }
  const rule = verdict.rule ?? "value";
  return {
    state: "miss",
    label: RULE_LABELS[rule](answerCell),
    message: richText(verdict.message),
    miss: richText(misses[rule] ?? ""),
    reads: readsLine(verdict.reads, valueAt),
  };
}

/** Every cell inside the grid that a set of reads covers, as addresses. */
export function cellsRead(reads: readonly Read[], width: number, height: number): Set<string> {
  const out = new Set<string>();
  for (const { box } of reads) {
    for (let r = box.top; r <= Math.min(box.bottom, height); r++) {
      for (let c = box.left; c <= Math.min(box.right, width); c++) {
        out.add(`${columnLetters(c)}${r}`);
      }
    }
  }
  return out;
}

/** The classes that outline each read range: read, plus an edge class on each side of the range. */
export function outlineClasses(
  reads: readonly Read[],
  width: number,
  height: number,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const { box } of reads) {
    const bottom = Math.min(box.bottom, height);
    const right = Math.min(box.right, width);
    for (let r = box.top; r <= bottom; r++) {
      for (let c = box.left; c <= right; c++) {
        const address = `${columnLetters(c)}${r}`;
        const set = out.get(address) ?? new Set<string>();
        set.add("read");
        if (r === box.top) set.add("read-top");
        if (r === box.bottom) set.add("read-bottom");
        if (c === box.left) set.add("read-left");
        if (c === box.right) set.add("read-right");
        out.set(address, set);
      }
    }
  }
  return out;
}

/** Hint 2: how the cells the formula reads differ from the cells the answer reads. */
export function compareWithAnswer(
  learner: readonly Read[] | null,
  answer: readonly Read[],
  width: number,
  height: number,
): string {
  if (learner === null) {
    return "Check a formula first. This hint then compares the cells it reads with the cells the answer reads.";
  }
  const mine = cellsRead(learner, width, height);
  const theirs = cellsRead(answer, width, height);
  const missing = [...theirs].filter((a) => !mine.has(a));
  const extra = [...mine].filter((a) => !theirs.has(a));
  if (mine.size === 0)
    return `Your formula reads no cells. The answer reads ${describeCells([...theirs])}.`;
  if (missing.length === 0 && extra.length === 0) {
    return "Your formula reads the same cells as the answer. Check the function and the other parts of the formula.";
  }
  const parts: string[] = [];
  if (missing.length > 0)
    parts.push(`Compared with the answer, your formula leaves out ${describeCells(missing)}.`);
  if (extra.length > 0)
    parts.push(`It also reads ${describeCells(extra)}, which the answer does not.`);
  return parts.join(" ");
}
