import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as statsRouteTree } from "./route-trees/stats.gen.js";

it("renders /stats for the rule: deprecated component piece (stats.tsx + stats.component.tsx)", async () => {
  const router = createRouter({
    routeTree: statsRouteTree,
    history: createMemoryHistory({ initialEntries: ["/stats"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Stats" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
});
