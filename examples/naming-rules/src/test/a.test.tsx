import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as aRouteTree } from "./route-trees/a.gen.js";

it("renders /a/b/c for the rule: flat dots (a.b.c.tsx)", async () => {
  const router = createRouter({
    routeTree: aRouteTree,
    history: createMemoryHistory({ initialEntries: ["/a/b/c"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Deep flat route" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
});
