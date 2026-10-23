import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as pricingRouteTree } from "./route-trees/pricing.gen.js";

it("renders /pricing from a route group ((marketing)/pricing.tsx)", async () => {
  const router = createRouter({
    routeTree: pricingRouteTree,
    history: createMemoryHistory({ initialEntries: ["/pricing"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Pricing" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
});
