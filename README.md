# tanstack-router-scoped-trees

[![npm](https://img.shields.io/npm/v/tanstack-router-scoped-trees)](https://www.npmjs.com/package/tanstack-router-scoped-trees)
[![CI](https://github.com/jdvivar/tanstack-router-scoped-trees/actions/workflows/ci.yml/badge.svg)](https://github.com/jdvivar/tanstack-router-scoped-trees/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/tanstack-router-scoped-trees)](LICENSE)

A Vite plugin and CLI for TanStack Router that generates one route tree per section of your app, so your route tests load only the routes they need.

This is a community package. It is not affiliated with TanStack and not an official TanStack package.

## Why

Every route test in a TanStack Router app usually starts with the same import:

```tsx
import { routeTree } from "../routeTree.gen";
```

That one line pulls in every route in the app. A test for one billing screen also loads settings, admin, onboarding and the rest, and every test file pays for it. On a small app nobody notices. On a big one, it adds up fast.

Building a small test tree by hand is quick, but it is a second copy of your routes, and it drifts from the real ones the first time someone adds a layout or renames a file.

This package gives you the small tree without the second copy. You define sections (billing, settings and so on), and it writes one tree per section:

```tsx
import { routeTree as billingRouteTree } from "./route-trees/billing.gen.js";
```

1. **Same output as TanStack.** It never patches or post-processes what TanStack generates. It hands one section's routes to TanStack's own generator, and a parity check proves the result is identical to what TanStack makes from only those files.
2. **Nested routes keep working.** Each section brings its root and the layouts above it.
3. **CI catches drift.** `generate --check` fails when a tree is stale or a new route is in no section, and tells you which route and what to add.

On a generated app with 1,000 routes, a test file ran 0.8 to 1.6 s faster per process, 25% to 46% less wall time. That is one machine, not CI, and your numbers depend on your app. Details and caveats are in [examples/benchmark/RESULTS.md](examples/benchmark/RESULTS.md).

The story behind it: [Your TanStack tests don't need the whole route tree](https://dev.to/jdvivar/your-tanstack-tests-dont-need-the-whole-route-tree-ha3).

## Install

```sh
npm i -D tanstack-router-scoped-trees
```

Also add `@tanstack/router-generator` as a devDependency, at the exact version your `@tanstack/router-plugin` uses. Without it, npm can install a second, newer copy for this package, and the trees would come from a different generator than the dev server's. Find the version and pin it:

```sh
npm ls @tanstack/router-generator
npm i -D @tanstack/router-generator@<version under @tanstack/router-plugin>
npm ls @tanstack/router-generator
```

The last command must show one version. If it does not, the CLI stops and the Vite plugin and the parity test say which versions differ. See [versions](docs/versions.md).

## Set up in five minutes

The code below comes from [examples/basic](examples/basic).

1. Add the plugin after `tanstackRouter()` in `vite.config.ts`:

   ```ts
   import { tanstackRouter } from "@tanstack/router-plugin/vite";
   import react from "@vitejs/plugin-react";
   import { scopedRouteTrees } from "tanstack-router-scoped-trees/vite";
   import { defineConfig } from "vite";

   export default defineConfig({
     plugins: [tanstackRouter(), scopedRouteTrees(), react()],
   });
   ```

2. Start the dev server once. The plugin detects your sections, writes `scoped-route-trees.config.ts` and generates the trees. Review the config:

   ```ts
   import { defineConfig } from "tanstack-router-scoped-trees";

   export default defineConfig({
     sections: {
       billing: ["/billing"],
       about: ["/about"],
       settings: ["/settings"],
     },
   });
   ```

3. Commit the config and the generated trees (by default in `src/test/route-trees`). Add that folder to `.prettierignore`, next to `routeTree.gen.ts`, and to any other formatter or linter that rewrites files. A reformatted tree no longer matches a fresh generation, so `generate --check` would fail:

   ```text
   src/routeTree.gen.ts
   src/test/route-trees
   ```

4. In one test, swap the full tree for a scoped one:

   ```tsx
   import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
   import { render, screen } from "@testing-library/react";
   import { expect, it } from "vitest";
   import { routeTree as billingRouteTree } from "./route-trees/billing.gen.js";

   it("renders the invoices page", async () => {
     const router = createRouter({
       routeTree: billingRouteTree,
       history: createMemoryHistory({ initialEntries: ["/billing/invoices"] }),
     });

     render(<RouterProvider router={router} />);

     expect(await screen.findByRole("heading", { name: "Invoices" })).toBeDefined();
   });
   ```

Generated files export TanStack's plain `routeTree`, so rename it on import.

Each section tree also contains the parent routes it needs (the root, and layouts above your routes), so nested routes keep working.

## One tree per test file

Import only one route tree in each test file. TanStack's generated trees change the shared root route, so a second import breaks the first. This includes mixing a scoped tree with the full tree.

To assert a redirect out of your section, write that test in its own file and import the full tree there. See [pitfalls](docs/pitfalls.md).

## CLI

```sh
npx tanstack-router-scoped-trees init
npx tanstack-router-scoped-trees generate
npx tanstack-router-scoped-trees generate --check
```

1. `init` writes `scoped-route-trees.config.ts` from the sections it detects.
2. `generate` refreshes the full tree and every scoped tree. It also creates the config if it is missing.
3. `generate --check` writes nothing and exits 1 if a tree is stale, a route is in no section, or parity fails. It is the check that compares committed trees with a fresh generation. Use it in CI. See [CI](docs/ci.md).

All commands take `--root <dir>`, and `--version` prints the package version.

The CLI reads routing options from `tsr.config.json` only. Keep every option that changes the generated output there too (`quoteStyle`, `semicolons`, `routeFileIgnorePattern` and so on). If such an option is only set inline in `tanstackRouter()`, the CLI and the dev server write different full trees and `generate --check` fails.

## Parity test

Add one test that builds every section tree in memory and checks it against what TanStack itself generates from the same files. It does not read your committed trees:

```ts
import { checkScopedRouteTrees, formatParityDifferences } from "tanstack-router-scoped-trees";
import { expect, it } from "vitest";

it("keeps every scoped tree in parity with the full route tree", async () => {
  expect(formatParityDifferences(await checkScopedRouteTrees())).toBe("");
}, 60_000);
```

It runs one TanStack crawl per section, so give it a longer timeout than the default.

## Not supported in v1

1. Apps that set `virtualRouteConfig` (the tool stops with a message).
2. Code-based routing. Only file-based routes.

## Guides

1. [Options](docs/options.md): every config field and its default.
2. [Sections](docs/sections.md): how prefixes, parents and common routes work.
3. [CI](docs/ci.md): keep trees fresh and checked.
4. [Pitfalls](docs/pitfalls.md): redirects out of a section, and tests that now fail.
5. [Troubleshooting](docs/troubleshooting.md)
6. [Versions](docs/versions.md)
7. [Contributing](CONTRIBUTING.md)

## License

MIT
