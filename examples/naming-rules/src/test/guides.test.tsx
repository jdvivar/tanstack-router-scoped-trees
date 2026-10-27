import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as guidesRouteTree } from "./route-trees/guides.gen.js";

it("renders /guides/setup for the rule: directory without route.tsx (guides/setup.tsx)", async () => {
  const router = createRouter({
    routeTree: guidesRouteTree,
    history: createMemoryHistory({ initialEntries: ["/guides/setup"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Setup guide" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
});
