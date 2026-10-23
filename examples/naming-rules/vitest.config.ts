import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // This repo links the package from its root; keep the link so Vitest loads it from node_modules.
  resolve: { preserveSymlinks: true },
  test: {
    environment: "jsdom",
  },
});
