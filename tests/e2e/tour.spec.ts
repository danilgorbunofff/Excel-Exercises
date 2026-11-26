// Why this exists: the first-visit tour of the exercise page. It opens once for
// a new visitor, walks every stop, closes on Escape, stays closed on the next
// visit and replays from the Tour button.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SUM = "/exercises/sum-a-column/";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

// A new visitor: no tour flag, no progress.
test.use({ storageState: { cookies: [], origins: [] } });

test("the tour opens once for a new visitor and walks every stop", async ({
  page,
  browserName,
}) => {
  await page.goto(SUM);
  const card = page.getByRole("dialog", { name: "Read the task" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("1 of 6");
  // Playwright's Firefox crashes its page when axe is scoped to the card;
  // Chromium and WebKit check it, and the full-page axe runs in all three.
  if (browserName !== "firefox")
    expect(
      (await new AxeBuilder({ page }).withTags(TAGS).include(".tour-card").analyze()).violations,
    ).toEqual([]);

  for (const title of [
    "The sheet",
    "Write your formula",
    "Check your answer",
    "Stuck?",
    "See this again",
  ]) {
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("dialog", { name: title })).toBeVisible();
  }
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(".tour-card")).toHaveCount(0);
  await expect(page.locator(".tour-spot")).toHaveCount(0);

  await page.reload();
  await expect(page.locator("#formula")).toBeVisible();
  await expect(page.locator(".tour-card")).toHaveCount(0);
});

test("Escape closes the tour and the Tour button replays it", async ({ page }) => {
  await page.goto(SUM);
  await expect(page.getByRole("dialog", { name: "Read the task" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".tour-card")).toHaveCount(0);

  await page.getByRole("button", { name: "How it works" }).click();
  await expect(page.getByRole("dialog", { name: "Read the task" })).toBeVisible();
  await page.getByRole("button", { name: "Skip tour" }).click();
  await expect(page.locator(".tour-card")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "How it works" })).toBeFocused();
});
