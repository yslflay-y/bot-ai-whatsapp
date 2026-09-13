import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://assistant:password@localhost:5432/test?schema=public",
      ALLOWLIST_NUMBERS: "6281234567890",
      ADMIN_NUMBERS: "6281234567890",
      GEMINI_API_KEY: "test_key",
      NODE_ENV: "test",
      LOG_LEVEL: "warn",
    },
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
