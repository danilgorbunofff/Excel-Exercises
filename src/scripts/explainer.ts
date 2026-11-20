// Why this exists: reruns the editable example on a function page when the
// formula or a cell changes, writes the result into its cell, and outlines
// the cells each reference reads in that reference's colour.
import { explain, type Ref } from "../lib/explain.ts";
import { parseCell } from "./cell-input.ts";

type Cell = number | string | boolean | null;

for (const root of document.querySelectorAll<HTMLElement>("[data-explainer]")) {
  const node = root.querySelector("[data-explainer-data]");
  const form = root.querySelector<HTMLFormElement>("[data-explainer-form]");
  const input = root.querySelector<HTMLTextAreaElement>("[data-explainer-input]");
  const value = root.querySelector<HTMLElement>("[data-explainer-value]");
  if (!node?.textContent || !form || !input || !value) continue;
  const reset = root.querySelector<HTMLButtonElement>("[data-explainer-reset]");
  const out = root.querySelector<HTMLInputElement>("[data-explainer-out]");
  const table = root.querySelector<HTMLTableElement>("table.grid");
  const wrap = root.querySelector<HTMLElement>(".grid-wrap");
  const boxes = root.querySelector<HTMLElement>("[data-explainer-boxes]");
  const data = JSON.parse(node.textContent) as {
    rows: Cell[][];
    summaries: Record<string, string>;
    syntaxes: Record<string, string>;
  };
  const original = data.rows.map((r) => [...r]);
  const originalFormula = input.value;
  let rows = data.rows.map((r) => [...r]);
  let refs: Ref[] = [];

  /** The table cell at a 1-based row and column, or null outside the sheet. */
  const cellAt = (row: number, col: number) => table?.tBodies[0]?.rows[row - 1]?.cells[col] ?? null;

  /** Outlines the cells each reference reads. Parts outside the sheet are cut off. */
  const drawBoxes = () => {
    if (!boxes || !wrap || !table) return;
    const body = table.tBodies[0];
    const height = body?.rows.length ?? 0;
    const width = (body?.rows[0]?.cells.length ?? 1) - 1;
    const origin = wrap.getBoundingClientRect();
    boxes.replaceChildren(
      ...refs.flatMap((ref, i) => {
        const from = cellAt(ref.box.top, ref.box.left);
        const to = cellAt(Math.min(ref.box.bottom, height), Math.min(ref.box.right, width));
        if (!from || !to) return [];
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const box = document.createElement("div");
        box.className = `box ref-${(i % 6) + 1}`;
        box.style.left = `${a.left - origin.left + wrap.scrollLeft}px`;
        box.style.top = `${a.top - origin.top + wrap.scrollTop}px`;
        box.style.width = `${b.right - a.left}px`;
        box.style.height = `${b.bottom - a.top}px`;
        return [box];
      }),
    );
  };
  if (wrap) new ResizeObserver(drawBoxes).observe(wrap);

  const run = () => {
    const r = explain(input.value, rows, data.summaries, data.syntaxes);
    value.textContent = r.ok ? r.result : "none";
    if (out) out.value = r.ok ? r.result : "";
    refs = r.ok ? r.refs : [];
    drawBoxes();
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    run();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      run();
    }
  });
  table?.addEventListener("input", (e) => {
    const cell = e.target as HTMLInputElement;
    if (!cell.dataset["cell"]) return;
    const [r, c] = cell.dataset["cell"].split(",").map(Number);
    const row = rows[r ?? 0];
    if (row) row[c ?? 0] = parseCell(cell.value);
    run();
  });
  reset?.addEventListener("click", () => {
    rows = original.map((r) => [...r]);
    for (const cell of root.querySelectorAll<HTMLInputElement>("[data-cell]")) {
      const [r, c] = (cell.dataset["cell"] ?? "0,0").split(",").map(Number);
      const v = original[r ?? 0]?.[c ?? 0] ?? null;
      cell.value = v === null ? "" : String(v);
    }
    input.value = originalFormula;
    run();
  });

  // The build wrote the result; this adds the outlines, which need layout.
  run();
}
