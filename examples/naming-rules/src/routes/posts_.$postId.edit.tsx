import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/posts_/$postId/edit")({
  component: EditPost,
});

function EditPost() {
  const { postId } = Route.useParams();

  return <h3>Edit post {postId}</h3>;
}
