import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/org/team/_guard/members")({
  component: () => <h3>Team members</h3>,
});
