import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(marketing)/pricing")({
  component: () => <h3>Pricing</h3>,
});
