import { createFileRoute } from "@tanstack/react-router";

import { proxyEpub, type CatalogSource } from "@/server/catalog";

const SOURCES = new Set<CatalogSource>(["gutenberg", "wikisource", "standard", "archive"]);

/** GET /api/catalog/download?source=wikisource&id=Dom Casmurro → EPUB */
export const Route = createFileRoute("/api/catalog/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const source = url.searchParams.get("source") as CatalogSource | null;
        const id = (url.searchParams.get("id") ?? "").slice(0, 300);
        if (!source || !SOURCES.has(source) || !id) {
          return Response.json({ error: "Livro inválido." }, { status: 400 });
        }
        return proxyEpub(source, id);
      },
    },
  },
});
