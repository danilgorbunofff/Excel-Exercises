// Why this exists: converts between A1-style cell addresses and column and row
// numbers. Columns run A to XFD and rows 1 to 1,048,576, as in Excel.

export const MAX_COLUMN = 16384;
export const MAX_ROW = 1048576;

export interface Address {
  col: number;
  row: number;
}

export interface CellAddress extends Address {
  absCol: boolean;
  absRow: boolean;
}

/** "A" is 1, "Z" is 26, "AA" is 27. */
export function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function columnLetters(index: number): string {
  let s = "";
  let n = index;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const ADDRESS = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})$/u;

/** Parses "B2", "$B$2" or "B$2". Returns null for anything that is not a valid cell. */
export function parseAddress(text: string): CellAddress | null {
  const m = ADDRESS.exec(text);
  if (!m) return null;
  const col = columnIndex(m[2] as string);
  const row = Number(m[4]);
  if (col > MAX_COLUMN || row < 1 || row > MAX_ROW) return null;
  return { col, row, absCol: m[1] === "$", absRow: m[3] === "$" };
}

export function formatAddress(a: Address): string {
  return `${columnLetters(a.col)}${a.row}`;
}
