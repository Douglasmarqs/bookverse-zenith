import { createFileRoute } from "@tanstack/react-router";

import { searchCatalog, type CatalogSource } from "@/server/catalog";

const SOURCES = new Set<CatalogSource>(["gutenberg", "wikisource", "standard", "archive"]);

/** GET /api/catalog/search?q=…&lang=pt&sources=gutenberg,wikisource */
export const Route = createFileRoute("/api/catalog/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
        if (q.length < 2) return Response.json({ results: [], sources: {} });
        const lang = url.searchParams.get("lang");
        const sources = (url.searchParams.get("sources") ?? "")
          .split(",")
          .filter((s): s is CatalogSource => SOURCES.has(s as CatalogSource));
        const data = await searchCatalog(q, { lang, sources });
        return Response.json(data, {
          headers: {
            "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
