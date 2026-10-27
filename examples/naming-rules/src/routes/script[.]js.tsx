import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/script.js")({
  component: () => <h3>Script file</h3>,
});
