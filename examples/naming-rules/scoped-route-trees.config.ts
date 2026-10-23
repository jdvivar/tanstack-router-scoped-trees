import { defineConfig } from "tanstack-router-scoped-trees";

export default defineConfig({
  sections: {
    dashboard: ["/dashboard"],
    posts: ["/posts"],
    pricing: ["/pricing"],
    files: ["/files"],
    shop: ["/shop"],
    script: ["/script.js"],
    reports: ["/reports"],
    lazyonly: ["/lazyonly"],
    stats: ["/stats"],
    docs: ["/docs"],
    guides: ["/guides"],
    a: ["/a"],
    articles: ["/articles"],
    team: ["/org"],
    organization: ["/$org"],
  },
});
