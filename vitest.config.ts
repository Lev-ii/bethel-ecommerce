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
    include: ["tests/**/*.test.ts"],
    reporters: ["default"],
  },
});
