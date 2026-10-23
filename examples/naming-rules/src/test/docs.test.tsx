import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as docsRouteTree } from "./route-trees/docs.gen.js";

it("renders /docs/intro for the rule: directory with route.tsx (docs/route.tsx + docs/intro.tsx)", async () => {
  const router = createRouter({
    routeTree: docsRouteTree,
    history: createMemoryHistory({ initialEntries: ["/docs/intro"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Introduction" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Docs" })).toBeDefined();
});
