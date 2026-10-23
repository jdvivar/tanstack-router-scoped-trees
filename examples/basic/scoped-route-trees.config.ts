import { defineConfig } from "tanstack-router-scoped-trees";

export default defineConfig({
  // How sections work: docs/sections.md
  sections: {
    billing: ["/billing"],
    about: ["/about"],
    settings: ["/settings"],
  },
});
