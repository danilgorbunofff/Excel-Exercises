// Why this exists: the colour tokens of direction D, "Workbench", modelled on
// Spreadsheet Center's look (docs/research/spreadsheetcenter.md) with its
// contrast failures fixed. The green is darkened from #21A366 to #18804F so
// text on or in it passes 4.5:1.
import type { Theme } from "../tokens.ts";

export const light: Theme = {
  bg: "#f9fafb",
  surface: "#ffffff",
  header: "#f3f4f6",
  text: "#101828",
  muted: "#4a5565",
  rule: "#e5e7eb",
  line: "#6a7282",
  primary: "#18804f",
  onPrimary: "#ffffff",
  focus: "#101828",
  read: "#0063b1",
  readTint: "#e3f0fd",
  miss: "#b42318",
  missTint: "#fee4e2",
  correct: "#18804f",
  correctTint: "#e9f9ef",
};

export const dark: Theme = {
  bg: "#0f141c",
  surface: "#161c26",
  header: "#1f2733",
  text: "#f3f4f6",
  muted: "#a3abb8",
  rule: "#2b3442",
  line: "#8a94a3",
  primary: "#18804f",
  onPrimary: "#ffffff",
  focus: "#f3f4f6",
  read: "#6cb4ff",
  readTint: "#0d2a47",
  miss: "#ff8a80",
  missTint: "#3d1412",
  correct: "#5ad08a",
  correctTint: "#0f2f1d",
};

/** Decorative only: the tinted area behind the grid card. Carries no text. */
export const panel = { light: "#e9f5ee", dark: "#111f18" };
