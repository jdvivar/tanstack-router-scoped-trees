import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$org/_guard/settings")({
  component: OrgSettings,
});

function OrgSettings() {
  const { org } = Route.useParams();

  return <h3>Settings for {org}</h3>;
}
