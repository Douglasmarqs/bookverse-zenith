import { createFileRoute } from "@tanstack/react-router";

import { handleTts } from "@/server/tts";

/** GET /api/tts?v=nova&t=Texto → audio/mpeg (natural voice for "Ouvir") */
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      GET: ({ request }) => handleTts(request),
    },
  },
});
