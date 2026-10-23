# Contributing

Thanks for helping. This is a community package, not an official TanStack package.

## Setup

1. Use Node 22.12 or newer (see `.nvmrc`).
2. Install with npm: `npm install`. Do not use pnpm or yarn.

## Checks

Run before opening a pull request:

```sh
npm run check
```

It runs typecheck, lint, format check, tests and a build. Fix formatting with `npm run format:write`.

## Examples

The three apps in `examples/` are npm workspaces:

1. `examples/basic`: the code shown in the README.
2. `examples/naming-rules`: every supported file naming style.
3. `examples/benchmark`: a generated 1,000 route app and a benchmark. Run `npm run bench` inside it.

```sh
npm run examples:test
npm run examples:check
```

`examples:check` runs `generate --check` in each example, so committed trees stay fresh. After changing generator code, run `npm run build` first because the examples use `dist`.

## Pull requests

1. Add a test for the change.
2. Add a changeset: `npx changeset`. Use one short line that says what changed for users.
3. Keep commit messages to one line in conventional style, such as `fix: handle trailing slashes in prefixes`.

## Releasing

Merging to `main` runs the release workflow. It opens a "chore: version package" pull request from the pending changesets, and merging that pull request publishes to npm through trusted publishing. There is no npm token in the repository.

The maintainer publishes the first version by hand, then adds the trusted publisher for `release.yml` on npmjs.com so the workflow can publish every version after it.
