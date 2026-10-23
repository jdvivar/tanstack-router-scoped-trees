import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { routeTree as postsRouteTree } from "./route-trees/posts.gen.js";

afterEach(cleanup);

it("renders /posts from a nested index (posts.tsx + posts.index.tsx)", async () => {
  const router = createRouter({
    routeTree: postsRouteTree,
    history: createMemoryHistory({ initialEntries: ["/posts"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "All posts" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Posts" })).toBeDefined();
});

it("renders /posts/42/edit from a non-nested route (posts_.$postId.edit.tsx)", async () => {
  const router = createRouter({
    routeTree: postsRouteTree,
    history: createMemoryHistory({ initialEntries: ["/posts/42/edit"] }),
  });

  render(<RouterProvider router={router} />);

  expect(await screen.findByRole("heading", { name: "Edit post 42" })).toBeDefined();
  expect(screen.getByRole("heading", { name: "Naming rules" })).toBeDefined();
  expect(screen.queryByRole("heading", { name: "Posts" })).toBeNull();
});
