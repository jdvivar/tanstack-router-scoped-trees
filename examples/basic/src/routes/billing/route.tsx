import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/billing")({
  component: () => (
    <section>
      <h1>Billing</h1>
      <Outlet />
    </section>
  ),
});
