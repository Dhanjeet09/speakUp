import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test("landing page loads and shows signup link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Start Speaking Now")).toBeVisible();
  });

  test("login page has email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});
