import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as organizationRouteTree } from "./route-trees/organization.gen.js";

it("renders /acme/settings for the rule: $param pathless prefix ($org/_guard.tsx)", async () => {
  const router = createRouter({
    routeTree: organizationRouteTree,
    history: createMemoryHistory({ initialEntries: ["/acme/settings"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Settings for acme" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Organization guard" })).toBeDefined();
});
