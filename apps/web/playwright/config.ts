import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: [
    { command: "npm run dev -w apps/server", port: 4000 },
    { command: "npm run dev -w apps/web", port: 3000 },
  ],
});
