import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx,mjs}", "tests/worker/**/*.test.{ts,tsx,mjs}"],
    exclude: ["**/node_modules/**", ".next/**", ".open-next/**", "out/**"],
  },
});
