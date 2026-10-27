import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/billing/invoices")({
  component: () => <h2>Invoices</h2>,
});
