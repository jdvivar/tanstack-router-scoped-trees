import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/articles/")({
  component: () => <h3>Articles</h3>,
});
