import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs/intro")({
  component: () => <h3>Introduction</h3>,
});
