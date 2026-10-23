import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { routeTree as teamRouteTree } from "./route-trees/team.gen.js";

it("renders /org/team/members from a multi-segment pathless prefix (org/team/_guard.tsx)", async () => {
  const router = createRouter({
    routeTree: teamRouteTree,
    history: createMemoryHistory({ initialEntries: ["/org/team/members"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Team members" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Team guard" })).toBeDefined();
});
