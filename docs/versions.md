# Versions

| Dependency                   | Supported range | Notes                                                                          |
| ---------------------------- | --------------- | ------------------------------------------------------------------------------ |
| Node                         | `>=22.12`       | Node 20 is end of life.                                                        |
| `@tanstack/router-generator` | `>=1.167.0 <2`  | Peer dependency. Installed with `@tanstack/router-plugin`.                     |
| Vite                         | `>=5`           | Optional peer. Only needed for the `tanstack-router-scoped-trees/vite` plugin. |

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
