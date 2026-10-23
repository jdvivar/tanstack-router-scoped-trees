import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as filesRouteTree } from "./route-trees/files.gen.js";

it("renders /files/reports/q3.pdf for the rule: splat (files/$.tsx)", async () => {
  const router = createRouter({
    routeTree: filesRouteTree,
    history: createMemoryHistory({ initialEntries: ["/files/reports/q3.pdf"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "File reports/q3.pdf" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
});
