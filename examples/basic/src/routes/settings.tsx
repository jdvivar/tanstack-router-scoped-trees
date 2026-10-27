import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: () => (
    <section>
      <h1>Settings</h1>
      <Outlet />
    </section>
  ),
});
