import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as dashboardRouteTree } from "./route-trees/dashboard.gen.js";

it("renders /dashboard from a pathless layout with a lazy companion (_auth.tsx + _auth.lazy.tsx + _auth.dashboard.tsx)", async () => {
  const router = createRouter({
    routeTree: dashboardRouteTree,
    history: createMemoryHistory({ initialEntries: ["/dashboard"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Dashboard for Ada" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Signed-in area" })).toBeDefined();
});
