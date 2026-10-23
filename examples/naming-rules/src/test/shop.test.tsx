import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { routeTree as shopRouteTree } from "./route-trees/shop.gen.js";

afterEach(cleanup);

it("renders /shop/shoes from a optional param, present (shop.{-$category}.tsx)", async () => {
  const router = createRouter({
    routeTree: shopRouteTree,
    history: createMemoryHistory({ initialEntries: ["/shop/shoes"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Shop: shoes" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
});

it("renders /shop from a optional param, absent (shop.{-$category}.tsx)", async () => {
  const router = createRouter({
    routeTree: shopRouteTree,
    history: createMemoryHistory({ initialEntries: ["/shop"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Shop: everything" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
});
