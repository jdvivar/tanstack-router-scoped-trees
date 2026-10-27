import { defineConfig } from "tanstack-router-scoped-trees";

export default defineConfig({
  // How sections work: https://github.com/jdvivar/tanstack-router-scoped-trees/blob/main/docs/sections.md
  sections: {
    billing: ["/billing"],
    about: ["/about"],
    settings: ["/settings"],
  },
});
