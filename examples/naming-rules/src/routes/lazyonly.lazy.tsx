import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/lazyonly")({
  component: () => <h3>Lazy only</h3>,
});
