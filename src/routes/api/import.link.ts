import { createFileRoute } from "@tanstack/react-router";

import { importLink } from "@/server/link-import";

/** GET /api/import/link?url=https://… → the file, streamed */
export const Route = createFileRoute("/api/import/link")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("url") ?? "";
        if (!raw || raw.length > 2000)
          return Response.json({ error: "Link inválido." }, { status: 400 });
        return importLink(raw);
      },
    },
  },
});
