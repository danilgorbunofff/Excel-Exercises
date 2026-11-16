// Why this exists: Excel's error values (#N/A, #DIV/0! and so on) as shared
// objects, so they cannot be confused with text that happens to look the same.

export const ERROR_CODES = [
  "#CALC!",
  "#DIV/0!",
  "#N/A",
  "#NAME?",
  "#NULL!",
  "#NUM!",
  "#REF!",
  "#SPILL!",
  "#VALUE!",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorValue {
  readonly kind: "error";
  readonly code: ErrorCode;
}

const ERRORS = new Map<ErrorCode, ErrorValue>(
  ERROR_CODES.map((code) => [code, Object.freeze({ kind: "error", code })]),
);

export function errorValue(code: ErrorCode): ErrorValue {
  return ERRORS.get(code) as ErrorValue;
}

export function isError(v: unknown): v is ErrorValue {
  return typeof v === "object" && v !== null && (v as { kind?: unknown }).kind === "error";
}
