import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as settingsRouteTree } from "./route-trees/settings.gen.js";

it("renders the profile page", async () => {
  const router = createRouter({
    routeTree: settingsRouteTree,
    history: createMemoryHistory({ initialEntries: ["/settings/profile"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Profile" })).toBeDefined();
});
