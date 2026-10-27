import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as aboutRouteTree } from "./route-trees/about.gen.js";

it("renders the about page", async () => {
  const router = createRouter({
    routeTree: aboutRouteTree,
    history: createMemoryHistory({ initialEntries: ["/about"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "About" })).toBeDefined();
});
