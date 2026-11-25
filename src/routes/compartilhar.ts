import { createFileRoute } from "@tanstack/react-router";

/**
 * Fallback for "Compartilhar → BookVerse" when the service worker isn't
 * active yet (it normally answers this POST itself, see public/sw.js).
 */
export const Route = createFileRoute("/compartilhar")({
  server: {
    handlers: {
      POST: () => new Response(null, { status: 303, headers: { Location: "/adicionar" } }),
      GET: () => new Response(null, { status: 302, headers: { Location: "/adicionar" } }),
    },
  },
});
