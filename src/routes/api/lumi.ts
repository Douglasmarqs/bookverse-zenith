import { createFileRoute } from "@tanstack/react-router";

import { handleLumi } from "@/server/lumi";

/** POST /api/lumi { messages, context } → { reply } */
export const Route = createFileRoute("/api/lumi")({
  server: {
    handlers: {
      POST: ({ request }) => handleLumi(request),
    },
  },
});
