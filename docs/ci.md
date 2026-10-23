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

The parity test never reads your committed trees. It builds each section tree in memory from your route files, then compares it with the full crawl and with what TanStack generates from only that section's files. So it validates the section building and your config, not the files in the repo.

`generate --check` is the only check that compares the committed files with a fresh generation. It catches a tree nobody refreshed after a route was added.

Together they cover both: the parity test says the generation logic is right, and `generate --check` says the committed output matches it.

In the other direction, `generate --check` cannot tell you that a scoped tree differs from what TanStack would build for the same files. The parity test does that.

Run `generate` locally after adding or moving a route, and commit the result.
