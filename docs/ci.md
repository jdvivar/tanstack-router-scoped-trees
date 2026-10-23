# CI

Two checks keep scoped trees honest. Run both.

```yaml
name: scoped-route-trees
on: [pull_request]

jobs:
  scoped-route-trees:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx tanstack-router-scoped-trees generate --check
      - run: npx vitest run src/test/parity.test.ts
```

Adjust the last line to wherever your parity test lives. It is the test from the [README](../README.md#parity-test).

## What `generate --check` does

It writes nothing. It exits 1 when:

1. The full route tree is out of date.
2. A scoped tree is out of date, or is left over from a section that no longer exists.
3. A route is in no section.
4. The parity check fails.

A failing run prints what to do. For stale trees:

```
The full route tree is out of date: src/routeTree.gen.ts
Scoped trees out of date in src/test/route-trees:
  billing
Run: npx tanstack-router-scoped-trees generate
```

When everything is fine it prints `Scoped route trees are up to date.`

## Why a parity test as well

`generate --check` covers everything: committed files that are out of date, routes in no section, and the parity comparison. It is the one check that compares committed files with a fresh generation.

The parity comparison itself never reads your committed trees. It builds each section tree in memory from your route files, then compares it with the full crawl and with what TanStack generates from only that section's files.

The separate parity test runs that same in-memory comparison inside your test suite. Use it when you want a failing test in the normal test run, or when your routing options are inline and the CLI cannot see them (pass them as `checkScopedRouteTrees({ router })`).

Run `generate` locally after adding or moving a route, and commit the result.
