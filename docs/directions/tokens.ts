// Why this exists: the colour and type tokens of the three Phase 2 directions,
// in one place, so the mocks and the contrast report read the same values.

export type Theme = Record<ColorToken, string>;
export type ColorToken =
  | "bg"
  | "surface"
  | "header"
  | "text"
  | "muted"
  | "rule"
  | "line"
  | "primary"
  | "onPrimary"
  | "focus"
  | "read"
  | "readTint"
  | "miss"
  | "missTint"
  | "correct"
  | "correctTint";

export interface Direction {
  id: string;
  name: string;
  textFont: { family: string; file: string };
  monoFont: { family: string; file: string };
  light: Theme;
  dark: Theme;
}

export const DIRECTIONS: Direction[] = [
  {
    id: "a-ledger",
    name: "Ledger",
    textFont: { family: "Source Serif 4", file: "source-serif-4" },
    monoFont: { family: "IBM Plex Mono", file: "ibm-plex-mono" },
    light: {
      bg: "#fbf9f4",
      surface: "#ffffff",
      header: "#f1ede3",
      text: "#1d1b16",
      muted: "#5c574c",
      rule: "#d9d2c3",
      line: "#8a8373",
      primary: "#1d1b16",
      onPrimary: "#fbf9f4",
      focus: "#1d1b16",
      read: "#8a5a00",
      readTint: "#fbeccb",
      miss: "#a8231b",
      missTint: "#fbe3df",
      correct: "#1d6b3a",
      correctTint: "#ddf0e3",
    },
    dark: {
      bg: "#16150f",
      surface: "#1f1e18",
      header: "#2a2820",
      text: "#ede8dc",
      muted: "#b3ac9c",
      rule: "#3d3a31",
      line: "#8d8676",
      primary: "#ede8dc",
      onPrimary: "#16150f",
      focus: "#ede8dc",
      read: "#e6b450",
      readTint: "#3a2f12",
      miss: "#ff9a8f",
      missTint: "#3e1c18",
      correct: "#7fd39b",
      correctTint: "#16331f",
    },
  },
  {
    id: "b-instrument",
    name: "Instrument",
    textFont: { family: "IBM Plex Sans", file: "ibm-plex-sans" },
    monoFont: { family: "IBM Plex Mono", file: "ibm-plex-mono" },
    light: {
      bg: "#f3f4f5",
      surface: "#ffffff",
      header: "#e9ebed",
      text: "#15181c",
      muted: "#4f555d",
      rule: "#d3d7dc",
      line: "#7c838c",
      primary: "#15181c",
      onPrimary: "#ffffff",
      focus: "#3d3bb8",
      read: "#4b48c9",
      readTint: "#e8e8fb",
      miss: "#b3261e",
      missTint: "#fde7e5",
      correct: "#176b37",
      correctTint: "#e0f2e6",
    },
    dark: {
      bg: "#0f1214",
      surface: "#171b1f",
      header: "#1f2429",
      text: "#e6e9ec",
      muted: "#a3aab2",
      rule: "#2c3238",
      line: "#7c848d",
      primary: "#e6e9ec",
      onPrimary: "#0f1214",
      focus: "#a9a7ff",
      read: "#a9a7ff",
      readTint: "#24233f",
      miss: "#ff9089",
      missTint: "#3a1a18",
      correct: "#6fd394",
      correctTint: "#14301e",
    },
  },
  {
    id: "c-marker",
    name: "Marker",
    textFont: { family: "Atkinson Hyperlegible Next", file: "atkinson-hyperlegible-next" },
    monoFont: { family: "Atkinson Hyperlegible Mono", file: "atkinson-hyperlegible-mono" },
    light: {
      bg: "#ffffff",
      surface: "#ffffff",
      header: "#f0f0f0",
      text: "#111111",
      muted: "#4a4a4a",
      rule: "#bdbdbd",
      line: "#111111",
      primary: "#111111",
      onPrimary: "#ffffff",
      focus: "#111111",
      read: "#6b5300",
      readTint: "#ffe36e",
      miss: "#9c1030",
      missTint: "#ffc7d3",
      correct: "#0b5a2a",
      correctTint: "#b6eec6",
    },
    dark: {
      bg: "#121212",
      surface: "#121212",
      header: "#242424",
      text: "#f4f4f4",
      muted: "#bdbdbd",
      rule: "#4a4a4a",
      line: "#f4f4f4",
      primary: "#f4f4f4",
      onPrimary: "#121212",
      focus: "#f4f4f4",
      read: "#ffe36e",
      readTint: "#4d3f00",
      miss: "#ff9db2",
      missTint: "#55142a",
      correct: "#86e3a3",
      correctTint: "#123f22",
    },
  },
];

/** Every pair that carries meaning, with its WCAG minimum. */
export const PAIRS: { fg: ColorToken; bg: ColorToken; min: number; use: string }[] = [
  { fg: "text", bg: "bg", min: 4.5, use: "body text" },
  { fg: "text", bg: "surface", min: 4.5, use: "cell text" },
  { fg: "text", bg: "header", min: 4.5, use: "grid header text" },
  { fg: "muted", bg: "bg", min: 4.5, use: "secondary text" },
  { fg: "muted", bg: "surface", min: 4.5, use: "secondary text in grid" },
  { fg: "muted", bg: "header", min: 4.5, use: "row and column labels" },
  { fg: "onPrimary", bg: "primary", min: 4.5, use: "primary button label" },
  { fg: "read", bg: "bg", min: 4.5, use: "'Read by your formula' label" },
  { fg: "miss", bg: "bg", min: 4.5, use: "'Miss' status word" },
  { fg: "correct", bg: "bg", min: 4.5, use: "'Correct' status word" },
  { fg: "text", bg: "readTint", min: 4.5, use: "cell text in a read cell" },
  { fg: "text", bg: "missTint", min: 4.5, use: "text on the miss tint" },
  { fg: "text", bg: "correctTint", min: 4.5, use: "text on the correct tint" },
  { fg: "miss", bg: "missTint", min: 4.5, use: "status word on the miss tint" },
  { fg: "correct", bg: "correctTint", min: 4.5, use: "status word on the correct tint" },
  { fg: "line", bg: "bg", min: 3, use: "input border" },
  { fg: "line", bg: "surface", min: 3, use: "input border on white" },
  { fg: "primary", bg: "bg", min: 3, use: "primary button shape" },
  { fg: "focus", bg: "bg", min: 3, use: "focus ring" },
  { fg: "focus", bg: "surface", min: 3, use: "focus ring in grid" },
  { fg: "read", bg: "surface", min: 3, use: "read-range outline" },
  { fg: "miss", bg: "surface", min: 3, use: "miss outline" },
  { fg: "correct", bg: "surface", min: 3, use: "correct outline" },
  { fg: "read", bg: "readTint", min: 3, use: "read outline over its tint" },
];
