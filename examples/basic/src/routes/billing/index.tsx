import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/billing/")({
  component: () => <h2>Overview</h2>,
});
