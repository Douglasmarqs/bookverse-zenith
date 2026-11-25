import { createFileRoute, redirect } from "@tanstack/react-router";

/** The old catalogue page now lives in Explorar; keep old links working. */
export const Route = createFileRoute("/catalogo")({
  beforeLoad: () => {
    throw redirect({ to: "/descobrir", search: {}, replace: true });
  },
});
