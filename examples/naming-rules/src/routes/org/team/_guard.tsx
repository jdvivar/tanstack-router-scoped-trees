import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/org/team/_guard")({
  component: () => (
    <section>
      <h2>Team guard</h2>
      <Outlet />
    </section>
  ),
});
