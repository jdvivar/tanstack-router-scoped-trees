import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as lazyonlyRouteTree } from "./route-trees/lazyonly.gen.js";

it("renders /lazyonly for the rule: lazy-only route (lazyonly.lazy.tsx)", async () => {
  const router = createRouter({
    routeTree: lazyonlyRouteTree,
    history: createMemoryHistory({ initialEntries: ["/lazyonly"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Lazy only" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
});
