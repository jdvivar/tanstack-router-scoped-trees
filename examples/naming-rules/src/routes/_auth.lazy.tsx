import { createLazyFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/_auth")({
  component: () => (
    <section>
      <h2>Signed-in area</h2>
      <Outlet />
    </section>
  ),
});
