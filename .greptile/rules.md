## Scope

This is a community package for TanStack Router, not an official TanStack package. It generates one route tree per section so route tests load fewer routes.

## Code

- TanStack packages are peer dependencies only, never regular dependencies.
- `vite` is imported as types only in `src/vite.ts`.
- The public API is what `src/index.ts` and `src/vite.ts` export; anything else is internal.
- Keep comments rare; prefer clear names.

## Docs

- Plain, concise, sentence case headings, numbered lists for steps.
- No long dashes ("—" or " - " used as punctuation).
- Code blocks in the README must match `examples/basic`.
