import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/posts")({
  component: () => (
    <section>
      <h2>Posts</h2>
      <Outlet />
    </section>
  ),
});
