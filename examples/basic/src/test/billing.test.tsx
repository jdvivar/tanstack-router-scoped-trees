import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as billingRouteTree } from "./route-trees/billing.gen.js";

it("renders the invoices page", async () => {
  const router = createRouter({
    routeTree: billingRouteTree,
    history: createMemoryHistory({ initialEntries: ["/billing/invoices"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Invoices" })).toBeDefined();
});
