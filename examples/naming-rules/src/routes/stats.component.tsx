import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/stats")({});

export const component = () => <h3>Stats</h3>;
