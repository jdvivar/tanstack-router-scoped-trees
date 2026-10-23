import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/docs")({
  component: () => (
    <section>
      <h2>Docs</h2>
      <Outlet />
    </section>
  ),
});
