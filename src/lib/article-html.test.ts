import type { Element, Root } from "hast";
import { toHtml } from "hast-util-to-html";
import { describe, expect, it } from "vitest";
import { shapeArticle } from "./article-html.ts";

const t = (value: string) => ({ type: "text" as const, value });
const e = (tagName: string, children: Element["children"]): Element => ({
  type: "element",
  tagName,
  properties: {},
  children,
});
const run = (children: Root["children"]) => {
  const tree: Root = { type: "root", children };
  shapeArticle(tree);
  return toHtml(tree);
};

describe("shapeArticle", () => {
  it("turns a paragraph that is one formula into a formula bar", () => {
    const html = run([e("p", [e("code", [t("=SUM(A1:A3)")])])]);
    expect(html).toContain('<div class="formula">');
    expect(html).toContain("<code>=SUM(A1:A3)</code>");
    expect(html).toContain('aria-label="Copy formula"');
  });

  it("leaves code inside a sentence alone", () => {
    const html = run([e("p", [t("Use "), e("code", [t("=A1")]), t(" here.")])]);
    expect(html).not.toContain("formula");
  });

  it("puts a numbered heading's number in a badge and keeps its text", () => {
    const html = run([e("h2", [t("Step 2: days overdue")])]);
    expect(html).toContain('<span class="badge">Step 2</span>');
    expect(html.replace(/<[^>]+>/g, "")).toBe("Step 2: Days overdue");
  });

  it("boxes a Common mistakes section up to the next heading", () => {
    const html = run([
      e("h2", [t("Common mistakes")]),
      e("ul", [e("li", [t("One")])]),
      e("h2", [t("Next")]),
      e("p", [t("After.")]),
    ]);
    expect(html).toMatch(
      /<section class="note note-warn"><h2><svg[\s\S]*<\/ul><\/section><h2>Next/,
    );
  });
});
