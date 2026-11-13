import { describe, expect, it } from "vitest";
import { clampPane, formatElapsed } from "./workbench.ts";

describe("workbench helpers", () => {
  it("formats elapsed time", () => {
    expect(formatElapsed(0)).toBe("00:00:00");
    expect(formatElapsed(61_500)).toBe("00:01:01");
    expect(formatElapsed(3_723_000)).toBe("01:02:03");
  });
  it("keeps the pane inside its limits", () => {
    expect(clampPane(10)).toBe(25);
    expect(clampPane(90)).toBe(65);
    expect(clampPane(Number.NaN)).toBe(40);
  });
});
