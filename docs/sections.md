# Sections

A section is a name and a list of URL prefixes. Its tree holds every route whose URL equals a prefix or sits below it.

```ts
export default defineConfig({
  sections: {
    billing: ["/billing"],
    settings: ["/settings", "/profile"],
  },
});
```

## Prefix rules

1. `"/billing"` matches `/billing` and `/billing/invoices`. It does not match `/billing-admin`, and `"/bill"` does not match `/billing`.
2. `"/"` is not a valid prefix.
3. A prefix that matches no route is an error that names the section and the prefix. This catches typos such as `"/biling"`.

## Parents come along

Routes above a matched route are added automatically: the root route, layouts, and pathless layouts. You do not list them. Routes that share a route id with a selected route are included too, so split files (such as `.lazy` ones) stay together.

## Common routes

Some routes belong in every tree, for example a page that guards redirect to, such as `/forbidden`. List them as exact paths:

```ts
export default defineConfig({
  sections: { billing: ["/billing"] },
  commonRoutes: ["/forbidden"],
});
```

The root index (`/`) does not have to be in any section, so it is not reported as uncovered. It is also not in a tree unless you add `"/"` to `commonRoutes`. Add it if your tests start on `/` or redirect there.

## Overlap is allowed

Two sections can claim the same route. It then appears in both trees.

## Generation on first use

If no config exists, `npx tanstack-router-scoped-trees generate` and the Vite plugin create one. Each first URL segment becomes a section, so `/billing/invoices` gives a `billing` section with the prefix `/billing`. Review the file and rename sections to taste.

You can also run `init`, which only writes the config.

## Routes in no section

If a route is covered by no prefix, `generate` stops and tells you what to add. A real run looks like this:

```
Some routes are not in any section (file paths are relative to your routes directory):

  /reports  (reports.tsx)

Add them to a section under `sections` in your config, for example:

    reports: ["/reports"],

Config file: /path/to/your-app/scoped-route-trees.config.ts
```

To skip this and let the tool create a section for each uncovered route, set `autoSectionUncovered: true`. The names come from the first URL segment, with a number added on a clash.

## Supported file styles

Section selection works on the routes TanStack itself resolves, so file naming does not matter. The [naming-rules example](examples/naming-rules) and its test fixtures cover these styles:

1. Flat dot routes (`a.b.c.tsx`, `posts.index.tsx`).
2. Directory routes with `route.tsx`.
3. Pathless layouts (`_auth.tsx`) and non-nested routes (`posts_.$postId.edit.tsx`).
4. Dynamic segments (`$org`), splats (`$.tsx`) and optional segments (`{-$category}`).
5. Escaped dots (`script[.]js.tsx`) and route groups (`(marketing)`).
6. `.lazy` and `.component` companion files.

## Editing the config in dev

The Vite plugin regenerates when the full route tree changes. Editing `scoped-route-trees.config.ts` alone does not trigger that. Run `npx tanstack-router-scoped-trees generate` or restart the dev server.
