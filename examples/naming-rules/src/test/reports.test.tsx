import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as reportsRouteTree } from "./route-trees/reports.gen.js";

it("renders /reports for the rule: lazy companion (reports.tsx + reports.lazy.tsx)", async () => {
  const router = createRouter({
    routeTree: reportsRouteTree,
    history: createMemoryHistory({ initialEntries: ["/reports"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "3 reports" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
});
