# Options

Set these in `scoped-route-trees.config.ts`. Only `sections` is required.

```ts
import { defineConfig } from "tanstack-router-scoped-trees";

export default defineConfig({
  sections: {
    billing: ["/billing"],
    settings: ["/settings", "/profile"],
  },
  commonRoutes: ["/forbidden"],
  outputDirectory: "src/test/route-trees",
  autoSectionUncovered: false,
});
```

## Config fields

| Field                  | Type                       | Default                  | What it does                                                                              |
| ---------------------- | -------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `sections`             | `Record<string, string[]>` | none (required)          | Section name to URL prefixes. Names match `/^[a-z0-9][a-z0-9-]*$/` and become file names. |
| `commonRoutes`         | `string[]`                 | `[]`                     | Exact URL paths added to every section.                                                   |
| `outputDirectory`      | `string`                   | `"src/test/route-trees"` | Where `<name>.gen.js` and `<name>.gen.d.ts` are written, relative to the project root.    |
| `autoSectionUncovered` | `boolean`                  | `false`                  | Create a section automatically for routes no prefix covers, instead of failing.           |
| `routesDirectory`      | `string`                   | from TanStack config     | Override the routes directory.                                                            |
| `generatedRouteTree`   | `string`                   | from TanStack config     | Override the path of the full generated tree.                                             |

`outputDirectory` must be dedicated to these trees. Stale `*.gen.js` and `*.gen.d.ts` files in it are pruned, so do not point it at a folder with other generated files. It must not be inside your routes directory.

Prefixes must start with `/`. A prefix of `/` is not valid, because it would match every route.

## Vite plugin options

```ts
scopedRouteTrees({ root: "./", router: { routesDirectory: "./src/pages" } });
```

| Option   | Default               | What it does                                                             |
| -------- | --------------------- | ------------------------------------------------------------------------ |
| `root`   | the Vite project root | Project root. A relative value resolves against the process cwd.         |
| `router` | none                  | Inline TanStack Router options, used when you have no `tsr.config.json`. |

The plugin runs in `serve` mode only, so a production build never writes files.

## Where routing options come from

The CLI reads `tsr.config.json` only. The Vite plugin also accepts `router`. If you keep options inline in `tanstackRouter(router)`, share one object with `scopedRouteTrees({ router })`, and pass the same object to `checkScopedRouteTrees({ router })`. The simplest setup is to keep routing options in `tsr.config.json`, which every part reads.

`routesDirectory` and `generatedRouteTree` in the scoped config take priority over `tsr.config.json`.
