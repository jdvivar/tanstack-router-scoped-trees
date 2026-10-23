# Troubleshooting

## Reading parity output

Most lines start with the section name. The "is in no section" line starts with the route file instead. Parity re-derives each section from only its own files through TanStack and compares the result with the section tree built in memory from your route files, byte for byte. It never reads the committed trees; use `generate --check` for that. It costs one extra TanStack crawl per section.

| Line                                                                    | Meaning                                                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `reports.tsx (/reports) is in no section`                               | Add a prefix for the route. See [sections](sections.md).                                |
| `billing: <file> is in the section but missing from the scoped tree`    | The section builder dropped a route it should keep. Not fixed by `generate`; report it. |
| `billing: <file> is in the scoped tree but not in the section`          | The section builder kept a route it should not. Not fixed by `generate`; report it.     |
| `billing: <file> fullPath: expected "/a", got "/b"`                     | A route resolves differently in the tree.                                               |
| `billing: the scoped tree differs from the tree TanStack generates ...` | The file text differs from what TanStack builds for the same files.                     |

Only the "is in no section" line is fixed by editing your config. Every other line means the section tree differs from what TanStack builds, and regenerating will not clear it. Report it at the [issue tracker](https://github.com/jdvivar/tanstack-router-scoped-trees/issues). Include the route files involved if you can.

Parity runs with relative imports internally. If your app sets `importRoutesUsingAbsolutePaths`, the import strings are not byte-checked.

## Stale trees

Symptoms: a route is missing in a test, or `generate --check` fails.

1. Run `npx tanstack-router-scoped-trees generate`.
2. Commit the changed files.

If you edited only `scoped-route-trees.config.ts`, the dev server does not notice. Run `generate` or restart it.

## Files disappeared from the output directory

`outputDirectory` is owned by this tool. Stale `*.gen.js` and `*.gen.d.ts` files there are removed. Use a folder that holds nothing else generated.

## "Two versions of @tanstack/router-generator are installed"

`@tanstack/router-plugin` uses one generator version and this package found another. Install the version the message names as a devDependency, then check that `npm ls @tanstack/router-generator` shows one version. See [versions](versions.md#one-generator-version).

## "sets virtualRouteConfig"

Apps whose routing uses `virtualRouteConfig` are not supported in v1. The tool stops with a message. File-based routing only.

## CLI and the Vite plugin disagree

The CLI reads `tsr.config.json` only. The Vite plugin can also take inline `router` options. If your routes directory is set inline, the CLI will not see it and may scan the wrong folder or find no routes.

Move the routing options to `tsr.config.json`. If you must keep them inline, share one object between `tanstackRouter(router)` and `scopedRouteTrees({ router })`, pass it to `checkScopedRouteTrees({ router })`, and avoid the CLI.

## The config file is not found in dev

A relative `scopedRouteTrees({ root })` resolves against the process cwd, not the Vite config file. Use an absolute path or leave `root` out.

## Config errors

1. A section name with spaces or `..` is rejected. Use lowercase letters, digits and hyphens.
2. A config with no `sections`, or an empty object, is rejected. Add sections, or delete the file and run `init`.
3. A prefix that matches no route is rejected, with the section name, the prefix and the config file. Fix the typo, or remove the prefix if its routes were deleted.
4. An unknown key is rejected, with the list of valid keys.
5. "Routes directory not found" names the folder it looked at. Set `routesDirectory` in `tsr.config.json`, in `scoped-route-trees.config.ts`, or in `scopedRouteTrees({ router })`.
6. "No sections detected" means the app has no routes besides `/`. The config is created once it does, or write `sections` by hand.
