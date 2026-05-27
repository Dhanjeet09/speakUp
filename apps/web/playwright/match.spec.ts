import { test, expect } from "@playwright/test";

test.describe("Match flow", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/match");
    await expect(page).toHaveURL(/\/login/);
  });
});
