// Why this exists: reruns the formula explainer in the browser when the
// formula or a cell of the example data changes.
import { type Explained, explain, type Step } from "../lib/explain.ts";

type Cell = number | string | boolean | null;

for (const root of document.querySelectorAll<HTMLElement>("[data-explainer]")) {
  const node = root.querySelector("[data-explainer-data]");
  const form = root.querySelector<HTMLFormElement>("[data-explainer-form]");
  const input = root.querySelector<HTMLTextAreaElement>("[data-explainer-input]");
  const result = root.querySelector<HTMLElement>("[data-explainer-result]");
  const tree = root.querySelector<HTMLElement>("[data-explainer-tree]");
  const reset = root.querySelector<HTMLButtonElement>("[data-explainer-reset]");
  // On a function page the result also shows in the cell the formula sits in.
  const out = root.querySelector<HTMLInputElement>("[data-explainer-out]");
  if (!node?.textContent || !form || !input || !result || !tree) continue;
  const data = JSON.parse(node.textContent) as {
    rows: Cell[][];
    summaries: Record<string, string>;
  };
  const original = data.rows.map((r) => [...r]);
  const originalFormula = input.value;
  const rows = data.rows.map((r) => [...r]);
  const cells = [...root.querySelectorAll<HTMLInputElement>("[data-cell]")];

  const parseCell = (text: string): Cell => {
    const t = text.trim();
    if (t === "") return null;
    if (/^(TRUE|FALSE)$/iu.test(t)) return t.toUpperCase() === "TRUE";
    const n = Number(t);
    return Number.isFinite(n) && /^[-+]?[\d.]+(e[-+]?\d+)?$/iu.test(t) ? n : text;
  };

  const renderStep = (step: Step): HTMLLIElement => {
    const li = document.createElement("li");
    const line = document.createElement("div");
    line.className = "step";
    const part = document.createElement("code");
    part.className = "part";
    part.textContent = step.text;
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    const value = document.createElement("span");
    value.className = "value";
    value.textContent = step.result;
    line.append(part, arrow, value);
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = step.note;
    li.append(line, note);
    if (step.children.length) {
      const ol = document.createElement("ol");
      ol.append(...step.children.map(renderStep));
      li.append(ol);
    }
    return li;
  };

  const show = (r: Explained) => {
    if (out) out.value = r.ok ? r.result : "";
    result.replaceChildren();
    if (!r.ok) {
      result.textContent = `This formula has an error: ${r.message}`;
      tree.replaceChildren();
      return;
    }
    const strong = document.createElement("strong");
    strong.className = "value";
    strong.textContent = r.result;
    result.append("Result: ", strong);
    const ol = document.createElement("ol");
    ol.className = "tree";
    ol.append(renderStep(r.steps));
    tree.replaceChildren(ol);
  };

  const run = () => show(explain(input.value, rows, data.summaries));

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
  for (const cell of cells) {
    cell.addEventListener("input", () => {
      const [r, c] = (cell.dataset["cell"] ?? "0,0").split(",").map(Number);
      const row = rows[r ?? 0];
      if (row) row[c ?? 0] = parseCell(cell.value);
      run();
    });
  }
  reset?.addEventListener("click", () => {
    original.forEach((row, r) => {
      rows[r] = [...row];
    });
    for (const cell of cells) {
      const [r, c] = (cell.dataset["cell"] ?? "0,0").split(",").map(Number);
      const v = original[r ?? 0]?.[c ?? 0] ?? null;
      cell.value = v === null ? "" : String(v);
    }
    input.value = originalFormula;
    run();
  });
}
