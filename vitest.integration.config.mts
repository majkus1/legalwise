import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Testy integracyjne — matryca uprawnień RLS uruchamiana na lokalnym Supabase.
 *
 * Wymagają wcześniejszego `npm run db:start`. Uruchamiane szeregowo
 * (jeden wątek), bo współdzielą stan bazy: równoległe czyszczenie danych
 * między plikami dawałoby wyniki zależne od kolejności.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    reporters: "verbose",
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Pliki testowe współdzielą jedną bazę i każdy czyści ją na starcie,
    // więc muszą iść po kolei, a nie równolegle.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
});
