import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/reports")({
  loader: () => ({ count: 3 }),
});
