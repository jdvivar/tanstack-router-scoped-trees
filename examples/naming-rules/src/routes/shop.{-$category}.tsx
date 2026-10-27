import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shop/{-$category}")({
  component: Shop,
});

function Shop() {
  const { category } = Route.useParams();

  return <h3>Shop: {category ?? "everything"}</h3>;
}
