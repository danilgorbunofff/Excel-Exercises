// Measures every text and UI colour pair in tokens.css, in both themes, and
// writes the table to a reviewed file. A token change that breaks contrast
// fails here; one that keeps contrast shows up as a diff in the table.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../tools/lib/contrast.ts";

const css = readFileSync("src/styles/tokens.css", "utf8");

/** Reads `--name: #hex` and `--name: light-dark(#a, #b)` into light and dark values. */
function readColorTokens(source: string): Map<string, { light: string; dark: string }> {
  const out = new Map<string, { light: string; dark: string }>();
  for (const m of source.matchAll(
    /--([\w-]+):\s*(?:light-dark\(\s*(#[0-9a-f]{3,6})\s*,\s*(#[0-9a-f]{3,6})\s*\)|(#[0-9a-f]{3,6}))\s*;/giu,
  )) {
    const [, name, light, dark, both] = m;
    if (name) out.set(name, { light: (light ?? both) as string, dark: (dark ?? both) as string });
  }
  return out;
}

const tokens = readColorTokens(css);
const TEXT = 4.5;
const UI = 3;

/** [foreground, background, minimum, where it is used] */
const PAIRS: [string, string, number, string][] = [
  ["text", "bg", TEXT, "body text"],
  ["text", "surface", TEXT, "cell and panel text"],
  ["text", "header", TEXT, "text on a grid header"],
  ["muted", "bg", TEXT, "secondary text"],
  ["muted", "surface", TEXT, "secondary text on a panel"],
  ["muted", "header", TEXT, "row and column labels"],
  ["on-primary", "primary", TEXT, "primary button label, correct status text"],
  ["on-primary", "primary-hover", TEXT, "primary button label on hover"],
  ["on-primary", "primary-active", TEXT, "primary button label when pressed"],
  ["correct", "surface", TEXT, "Next button label, links in green"],
  ["correct", "bg", TEXT, "Correct status word"],
  ["correct", "correct-tint", TEXT, "level label, answer cell when correct"],
  ["read", "surface", TEXT, "reference text"],
  ["read", "read-tint", TEXT, "reference code in the verdict"],
  ["miss", "surface", TEXT, "miss text"],
  ["miss", "miss-tint", TEXT, "status word on the miss tint"],
  ["text", "read-tint", TEXT, "cell text in a read cell"],
  ["text", "miss-tint", TEXT, "text on the miss tint"],
  ["text", "correct-tint", TEXT, "text on the correct tint"],
  ["line", "surface", UI, "input and button borders"],
  ["line", "bg", UI, "borders on the page"],
  ["primary", "panel", UI, "primary button shape on the sheet panel"],
  ["primary", "bg", UI, "primary button shape on the page"],
  ["surface", "primary", UI, "Next button shape on the correct status"],
  ["focus", "bg", UI, "focus ring on the page"],
  ["focus", "surface", UI, "focus ring on a panel"],
  ["focus", "panel", UI, "focus ring on the sheet panel"],
  ["focus", "primary", UI, "focus ring around Next on the correct status"],
  ["read", "surface", UI, "outline of a read range"],
  ["read", "read-tint", UI, "outline of a read range over its tint"],
  ["miss", "surface", UI, "outline of a missed answer cell"],
  ["miss", "miss-tint", UI, "status border on the miss tint"],
  ["correct", "surface", UI, "outline of a correct answer cell"],
  ["heading", "bg", TEXT, "large headings"],
  ["heading", "surface", TEXT, "headings on cards"],
  ["faint", "surface", TEXT, "meta text on cards"],
  ["faint", "bg", TEXT, "meta text on the page"],
  ["text", "header", UI, "active tab underline, level bars"],
  ["muted", "surface", UI, "empty level bars"],
  ["on-footer", "footer-bg", TEXT, "footer headings"],
  ["on-footer-muted", "footer-bg", TEXT, "footer links and text"],
  ["text", "hero-tint", TEXT, "hero text on the green wash"],
  ["muted", "hero-tint", TEXT, "hero lead on the green wash"],
  ["beginner", "beginner-bg", TEXT, "Beginner badge"],
  ["intermediate", "intermediate-bg", TEXT, "Intermediate badge"],
  ["advanced", "advanced-bg", TEXT, "Advanced badge"],
  ["pro", "pro-bg", TEXT, "PRO badge"],
  ["chip", "chip-bg", TEXT, "function chips"],
  ["tab-active", "surface", TEXT, "active tab label"],
  ["tab-active", "surface", UI, "active tab underline"],
  ["primary", "hero-tint", UI, "primary button on the hero wash"],
  ["on-primary", "offer-blue", TEXT, "text on the blue offer block and article cover"],
  ["on-primary", "offer-charcoal", TEXT, "text on the charcoal offer block and article cover"],
  ["on-footer", "on-dark-card", TEXT, "card headings on the dark home band"],
  ["on-footer-muted", "on-dark-card", TEXT, "card text on the dark home band"],
  ["primary-hover", "on-primary", TEXT, "label of the white button on the green last call"],
  ["primary-hover", "correct-tint-solid", TEXT, "that label on hover"],
  ...[1, 2, 3, 4, 5, 6].flatMap((n): [string, string, number, string][] => [
    [`ref-${n}`, "surface", TEXT, `reference ${n} in the explained formula`],
    [`ref-${n}`, "header", TEXT, `reference ${n} on the grey formula bar`],
    [`ref-${n}`, "surface", UI, `outline of the cells reference ${n} reads`],
  ]),
];

describe("design tokens", () => {
  it("defines every colour token used in a pair", () => {
    const missing = PAIRS.flatMap(([fg, bg]) => [fg, bg]).filter((t) => !tokens.has(t));
    expect([...new Set(missing)]).toEqual([]);
  });

  const rows = PAIRS.map(([fg, bg, min, use]) => {
    const f = tokens.get(fg);
    const b = tokens.get(bg);
    const light = f && b ? contrastRatio(f.light, b.light) : 0;
    const dark = f && b ? contrastRatio(f.dark, b.dark) : 0;
    return { fg, bg, min, use, light, dark };
  });

  for (const r of rows) {
    it(`${r.fg} on ${r.bg} reaches ${r.min}:1 in both themes`, () => {
      expect(r.light).toBeGreaterThanOrEqual(r.min);
      expect(r.dark).toBeGreaterThanOrEqual(r.min);
    });
  }

  it("match the reviewed contrast table", async () => {
    const table = [
      "# Measured contrast",
      "",
      "Generated by `src/styles/tokens.test.ts` from `src/styles/tokens.css`.",
      "",
      "| Foreground | Background | Use | Min | Light | Dark |",
      "| --- | --- | --- | --- | --- | --- |",
      ...rows.map(
        (r) =>
          `| ${r.fg} | ${r.bg} | ${r.use} | ${r.min} | ${r.light.toFixed(2)} | ${r.dark.toFixed(2)} |`,
      ),
      "",
    ].join("\n");
    await expect(table).toMatchFileSnapshot("../../docs/design/contrast.md");
  });
});
