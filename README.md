# tanstack-router-scoped-trees

Generate one TanStack Router route tree per section of your app, so a route test loads only the routes it needs.

This is a community package. It is not affiliated with TanStack and not an official TanStack package.

## Why

TanStack Router builds one route tree for the whole app. A test for a single billing screen still imports every route in the app before it can render. On a large app that cost is paid in every test file.

This package generates a smaller tree for each section you define (billing, settings, and so on). A billing test imports the billing tree and nothing else.

In a local measurement (one machine, not CI) on a generated app with 1,000 routes, a test file ran 0.8 to 1.6 s faster per process, 25% to 46% less wall time. Details and caveats are in [examples/benchmark/RESULTS.md](examples/benchmark/RESULTS.md). Your numbers depend on your app.

## Install

```sh
npm i -D tanstack-router-scoped-trees
```

You also need `@tanstack/router-generator` (it comes with `@tanstack/router-plugin`). See [versions](docs/versions.md).

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

3. Commit the config and the generated trees (by default in `src/test/route-trees`).

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
3. `generate --check` writes nothing and exits 1 if a tree is stale, a route is in no section, or parity fails. Use it in CI. See [CI](docs/ci.md).

All commands take `--root <dir>`. The CLI reads routing options from `tsr.config.json` only.

## Parity test

Add one test that checks every scoped tree against what TanStack itself generates:

```ts
import { checkScopedRouteTrees, formatParityDifferences } from "tanstack-router-scoped-trees";
import { expect, it } from "vitest";

it("keeps every scoped tree in parity with the full route tree", async () => {
  expect(formatParityDifferences(await checkScopedRouteTrees())).toBe("");
});
```

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
