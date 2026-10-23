import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as articlesRouteTree } from "./route-trees/articles.gen.js";

it("renders /articles from a index without a parent file (articles.index.tsx)", async () => {
  const router = createRouter({
    routeTree: articlesRouteTree,
    history: createMemoryHistory({ initialEntries: ["/articles"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Articles" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
});
