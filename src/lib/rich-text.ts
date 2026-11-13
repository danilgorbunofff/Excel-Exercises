// Why this exists: prose in exercises and verdicts marks code with backticks
// and names cells such as B6. The page and the exercise script both turn that
// into segments, so code and cell names look the same everywhere.
import { columnLetters, parseAddress } from "@practice/grader";

export type Segment = { kind: "text" | "code" | "cell"; text: string };

/** A cell address or range on its own: B6, AB12 or A2:C4, not part of P-104 or LOG10. */
const CELL =
  /(?<![\w-])\$?[A-Z]{1,2}\$?[1-9][0-9]{0,6}(?::\$?[A-Z]{1,2}\$?[1-9][0-9]{0,6})?(?![\w-])/gu;
const FUNCTION_LIKE = /^(LOG10|ATAN2|LOG2)$/u;

export function richText(source: string): Segment[] {
  const out: Segment[] = [];
  const push = (kind: Segment["kind"], text: string) => {
    if (!text) return;
    const last = out.at(-1);
    if (last && last.kind === "text" && kind === "text") last.text += text;
    else out.push({ kind, text });
  };
  source.split(/(`[^`]*`)/u).forEach((part, i) => {
    if (i % 2 === 1) {
      push("code", part.slice(1, -1));
      return;
    }
    let at = 0;
    for (const m of part.matchAll(CELL)) {
      if (FUNCTION_LIKE.test(m[0])) continue;
      push("text", part.slice(at, m.index));
      push("cell", m[0]);
      at = m.index + m[0].length;
    }
    push("text", part.slice(at));
  });
  return out;
}

/** Names a set of cells briefly: runs down a column become ranges such as B2:B4. */
export function describeCells(cells: readonly string[]): string {
  const parsed = cells
    .map((c) => parseAddress(c))
    .filter((a) => a !== null)
    .sort((a, b) => a.col - b.col || a.row - b.row);
  const runs: string[] = [];
  let i = 0;
  while (i < parsed.length) {
    const start = parsed[i];
    if (!start) break;
    let end = start;
    while (parsed[i + 1]?.col === start.col && parsed[i + 1]?.row === end.row + 1) {
      i += 1;
      end = parsed[i] ?? end;
    }
    const a = `${columnLetters(start.col)}${start.row}`;
    runs.push(end === start ? a : `${a}:${columnLetters(end.col)}${end.row}`);
    i += 1;
  }
  if (runs.length <= 1) return runs.join("");
  return `${runs.slice(0, -1).join(", ")} and ${runs.at(-1)}`;
}
