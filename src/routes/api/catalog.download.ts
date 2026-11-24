import { createFileRoute } from "@tanstack/react-router";

import { proxyEpub, resolveEpubUrl, type CatalogSource } from "@/server/catalog";

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
        // Temporary diagnostics: what the upstream answers from this server.
        if (url.searchParams.get("diag") === "1") {
          const target = await resolveEpubUrl(source, id);
          const started = Date.now();
          try {
            const r = await fetch(target ?? "", {
              redirect: "follow",
              headers: { "User-Agent": "BookVerse/1.0 (+https://bookverse-zenith.vercel.app)" },
            });
            return Response.json({
              target,
              status: r.status,
              type: r.headers.get("content-type"),
              length: r.headers.get("content-length"),
              finalUrl: r.url,
              ms: Date.now() - started,
              head: r.ok ? null : (await r.text()).slice(0, 300),
            });
          } catch (e) {
            return Response.json({ target, error: String(e), ms: Date.now() - started });
          }
        }
        return proxyEpub(source, id);
      },
    },
  },
});
