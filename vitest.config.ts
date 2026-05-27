import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["apps/server/src/**/*.test.ts"],
    environment: "node",
  },
});
