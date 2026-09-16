import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // "server-only" refuse de se charger hors d'un rendu Next : on le
      // neutralise pour pouvoir tester les modules qui le declarent.
      "server-only": `${root}tests/stubs/server-only.ts`,
      "@": `${root}src`,
    },
  },
  test: {
    environment: "node",
    // Les tests de tests/db exigent un vrai PostgreSQL : ils ne tournent qu'avec
    // "npm run test:db", jamais avec "npm test", qui doit rester autonome.
    include: process.env.VITEST_DB ? ["tests/db/**/*.test.ts"] : ["tests/unit/**/*.test.ts"],
    // Une seule base partagee : les fichiers ne doivent pas s'executer en parallele.
    fileParallelism: !process.env.VITEST_DB,
    reporters: ["default"],
  },
});
