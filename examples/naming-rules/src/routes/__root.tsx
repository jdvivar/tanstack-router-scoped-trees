import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    <>
      <h1>Naming rules</h1>
      <Outlet />
    </>
  ),
});
