import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as scriptRouteTree } from "./route-trees/script.gen.js";

it("renders /script.js from a escaped dot (script[.]js.tsx)", async () => {
  const router = createRouter({
    routeTree: scriptRouteTree,
    history: createMemoryHistory({ initialEntries: ["/script.js"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Script file" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
});
