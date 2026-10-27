# Versions

| Dependency                   | Supported range | Notes                                                                          |
| ---------------------------- | --------------- | ------------------------------------------------------------------------------ |
| Node                         | `>=22.12`       | Node 20 is end of life.                                                        |
| `@tanstack/router-generator` | `>=1.167.0 <2`  | Peer dependency. Pin it to the version your `@tanstack/router-plugin` uses.    |
| Vite                         | `>=5 <9`        | Optional peer. Only needed for the `tanstack-router-scoped-trees/vite` plugin. |

## One generator version

`@tanstack/router-plugin` depends on one exact `@tanstack/router-generator` version. Add the same version as a devDependency, so npm installs one copy that both use. `npm ls @tanstack/router-generator` must show a single version. If two are installed, the CLI exits 1, the Vite plugin warns and the parity test fails, each naming both versions.

## Frameworks

React is tested. Solid should work, because the trees come from TanStack's generator and not from the framework, but it is untested.

## Not supported in v1

1. `virtualRouteConfig`.
2. Code-based routing.

## Tested with

The versions used in this repo's examples and tests:

1. `@tanstack/router-generator` 1.167.44
2. `@tanstack/react-router` 1.170.44
3. Vite 8.3
4. Vitest 5.0
