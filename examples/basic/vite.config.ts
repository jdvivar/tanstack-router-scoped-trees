import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { scopedRouteTrees } from "tanstack-router-scoped-trees/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tanstackRouter(), scopedRouteTrees(), react()],
});
