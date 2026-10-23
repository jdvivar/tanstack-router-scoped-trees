import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/guides/setup")({
  component: () => <h3>Setup guide</h3>,
});
