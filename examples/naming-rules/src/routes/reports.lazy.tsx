import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/reports")({
  component: Reports,
});

function Reports() {
  const { count } = Route.useLoaderData();

  return <h3>{count} reports</h3>;
}
