import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/a/b/c")({
  component: () => <h3>Deep flat route</h3>,
});
