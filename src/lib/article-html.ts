// Why this exists: articles are plain Markdown, but three patterns in them
// read better with their own look. A paragraph that is one formula becomes a
// formula bar with a copy button. A numbered heading ("Step 2: ...", "3. ...")
// gets a number badge. A "Common mistakes" or "Checks" section becomes a
// boxed note. The heading text stays the same, so ids and contents do not move.
import type { Element, ElementContent, Root, RootContent } from "hast";

const WARN = /^(common mistakes|things to watch|what not to do)$/i;
const CHECK = /^(checks?|checks before you trust it)$/i;
const TIP =
  /^(which (one )?to use|when to use which|a habit worth keeping|a good habit|a good default|a habit that catches most of them)$/i;
const STEP = /^((?:Step )?\d+)([.:]\s+)/;

// 24px line icons, the same style as src/components/Icon.astro.
const PATHS = {
  warn: "M12 4l9 16H3zM12 10v4M12 17h.01",
  check: "M5 12l4 4 10-10",
  tip: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
} as const;

const el = (
  tagName: string,
  properties: Element["properties"],
  children: ElementContent[] = [],
): Element => ({ type: "element", tagName, properties, children });

const icon = (name: keyof typeof PATHS): Element =>
  el(
    "svg",
    {
      className: ["icon"],
      width: 18,
      height: 18,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.75",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ariaHidden: "true",
      focusable: "false",
    },
    [el("path", { d: PATHS[name] })],
  );

const text = (node: ElementContent | RootContent): string =>
  node.type === "text" ? node.value : "children" in node ? node.children.map(text).join("") : "";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const isBlank = (node: ElementContent) => node.type === "text" && node.value.trim() === "";

/** A paragraph holding one inline code span and nothing else. */
function asFormula(p: Element): Element | null {
  const kids = p.children.filter((c) => !isBlank(c));
  const [only] = kids;
  if (kids.length !== 1 || only?.type !== "element" || only.tagName !== "code") return null;
  return el("div", { className: ["formula"] }, [
    el("span", { className: ["fx"], ariaHidden: "true" }, [{ type: "text", value: "fx" }]),
    only,
    el("button", { type: "button", className: ["copy"], ariaLabel: "Copy formula", dataCopy: "" }, [
      icon("copy"),
    ]),
  ]);
}

/** Wraps "Step 2" or "3" at the start of a heading in a badge, and hides the separator. */
function badgeStep(h: Element): void {
  const first = h.children[0];
  if (first?.type !== "text") return;
  const m = STEP.exec(first.value);
  if (!m) return;
  h.properties.className = ["step"];
  h.children = [
    el("span", { className: ["badge"] }, [{ type: "text", value: m[1] ?? "" }]),
    el("span", { className: ["visually-hidden"] }, [{ type: "text", value: m[2] ?? "" }]),
    // "Step 1: fix the date" reads as "[Step 1] Fix the date".
    { type: "text", value: capitalise(first.value.slice(m[0].length)) },
    ...h.children.slice(1),
  ];
}

function kindOf(heading: string): "warn" | "check" | "tip" | null {
  if (WARN.test(heading)) return "warn";
  if (CHECK.test(heading)) return "check";
  if (TIP.test(heading)) return "tip";
  return null;
}

/** Reshapes an article's HTML tree in place. Wired up in astro.config.ts. */
export function shapeArticle(tree: Root): void {
  {
    const out: RootContent[] = [];
    let box: Element | null = null;
    for (const node of tree.children) {
      if (node.type === "element" && node.tagName === "h2") {
        box = null;
        const kind = kindOf(text(node).trim());
        badgeStep(node);
        if (kind) {
          node.children.unshift(icon(kind));
          box = el("section", { className: ["note", `note-${kind}`] }, [node]);
          out.push(box);
          continue;
        }
      }
      const item =
        node.type === "element" && node.tagName === "p" ? (asFormula(node) ?? node) : node;
      if (box) box.children.push(item as ElementContent);
      else out.push(item);
    }
    tree.children = out;
  }
}
