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

## Why both checks

They answer different questions.

The parity test compares two generated files with each other: the scoped trees against the full tree. If you add a route and run only the tests, both are stale in the same way, so parity still passes. `generate --check` regenerates from your route files and compares with what is committed, so it catches a tree nobody refreshed.

In the other direction, `generate --check` cannot tell you that a scoped tree differs from what TanStack would build for the same files. The parity test does that.

Run `generate` locally after adding or moving a route, and commit the result.
