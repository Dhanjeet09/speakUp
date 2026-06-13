import { test, expect } from "@playwright/test";

test.describe("Match flow", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/match");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Match page unauthenticated", () => {
  test("redirects to login from match page", async ({ page }) => {
    await page.goto("/match");
    await expect(page).toHaveURL(/\/login/);
  });

  test("does not show match content when not logged in", async ({ page }) => {
    await page.goto("/match");
    await expect(page.locator("text=Ready to practice?")).not.toBeVisible();
  });

  test("does not show Find a Partner button when not logged in", async ({ page }) => {
    await page.goto("/match");
    await expect(page.locator("text=Find a Partner")).not.toBeVisible();
  });
});

test.describe("Chat page unauthenticated", () => {
  test("redirects to login from chat page", async ({ page }) => {
    await page.goto("/chat");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Dashboard navigation to match", () => {
  test("redirects to login from dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Landing page loads", () => {
  test("landing page loads successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
  });
});
