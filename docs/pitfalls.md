# Pitfalls

## One tree per test file

TanStack's generated route trees change the shared root route when they load. If a test file imports two trees (two scoped trees, or a scoped one and the full one), the second import breaks the first.

Import one tree in each test file. If a scenario needs routes from two sections, either add those prefixes to one section or use the full tree in that file.

## Asserting a redirect out of your section

A scoped tree has no routes outside its section, so a redirect that leaves the section has no destination. The router stops on NotFound, and this assertion still passes:

```tsx
// The billing tree has no /home routes, so this proves nothing.
expect(router.state.location.pathname).toBe("/home/dashboard");
```

The destination's own `beforeLoad` never runs either, so a bug there cannot fail the test.

Put that test in its own file and import the full tree:

```tsx
import { routeTree } from "../routeTree.gen.js";

const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/billing"] }),
});
```

Keep it in a separate file from your scoped tests. See the first pitfall.

## When a scoped test fails but passes alone

A scoped tree changes which modules a test file loads, so a component can arrive a tick later than it did with the full tree. A test like this only passes when both elements land in the same tick:

```tsx
await waitFor(() => expect(screen.getByText("Invoices")).toBeInTheDocument());
expect(screen.getByTestId("invoice-table")).toBeInTheDocument(); // never waited for
```

Wait for the thing you assert:

```tsx
expect(await screen.findByTestId("invoice-table")).toBeInTheDocument();
```

The full tree hides this by loading everything up front, so such a test can pass for years before a scoped tree exposes it. The fix is in the test, not in the tree.

## Stale trees after config edits

The dev plugin regenerates when the full tree changes. Editing `scoped-route-trees.config.ts` alone does not. Run `npx tanstack-router-scoped-trees generate` or restart dev.
