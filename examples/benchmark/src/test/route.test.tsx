import {
  type AnyRoute,
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

const { routeTree }: { routeTree: AnyRoute } =
  process.env.ROUTE_TREE === "full"
    ? await import("../routeTree.gen")
    : await import("./route-trees/section-20.gen.js");

it("renders a page", async () => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/section-20/page-12"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "section-20 page-12" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "section-20" })).toBeDefined();
});
