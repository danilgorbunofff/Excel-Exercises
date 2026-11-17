// Why this exists: fails on any serious or critical axe finding, on every
// route, in light and dark colour schemes.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { allRoutes } from "./routes.ts";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

for (const route of allRoutes()) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`axe: ${route} (${colorScheme})`, async ({ page }) => {
      // Reduced motion: axe must not read colours mid-fade (price-in, label colour transition).
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(route);
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      const blocking = violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map(
          (v) =>
            `${v.impact} ${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
        );
      expect(blocking).toEqual([]);
    });
  }
}
