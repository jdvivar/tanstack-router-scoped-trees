import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const ROUTE_TEST = "src/test/route.test.tsx";

export default defineConfig({
  plugins: [react()],
  // This repo links the package from its root; keep the link so Vitest loads it from node_modules.
  resolve: { preserveSymlinks: true },
  test: {
    environment: "jsdom",
    projects: [
      { extends: true, test: { name: "full", include: [ROUTE_TEST], env: { ROUTE_TREE: "full" } } },
      {
        extends: true,
        test: { name: "scoped", include: [ROUTE_TEST], env: { ROUTE_TREE: "scoped" } },
      },
      { extends: true, test: { name: "parity", include: ["src/test/parity.test.ts"] } },
    ],
  },
});
