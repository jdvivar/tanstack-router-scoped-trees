import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$org/_guard")({
  component: () => (
    <section>
      <h2>Organization guard</h2>
      <Outlet />
    </section>
  ),
});
