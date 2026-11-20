// Why this exists: reads what someone typed in a sheet cell the way Excel
// does: blank, TRUE/FALSE, a number, or text.
import type { CellInput } from "@practice/grader";

export function parseCell(text: string): CellInput {
  const t = text.trim();
  if (t === "") return null;
  if (/^(TRUE|FALSE)$/iu.test(t)) return t.toUpperCase() === "TRUE";
  const n = Number(t);
  return Number.isFinite(n) && /^[-+]?[\d.]+(e[-+]?\d+)?$/iu.test(t) ? n : text;
}
