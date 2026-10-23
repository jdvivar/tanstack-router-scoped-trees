import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/files/$")({
  component: File,
});

function File() {
  const { _splat } = Route.useParams();

  return <h3>File {_splat}</h3>;
}
