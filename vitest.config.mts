import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Testy jednostkowe — czysta logika domenowa, bez bazy danych.
 * Testy RLS wymagające działającego Supabase są w vitest.integration.config.mts.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    reporters: "verbose",
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
});
