/**
 * Unified free-books catalogue (server only).
 *
 * One search asks every source at once — Project Gutenberg (via Gutendex),
 * Wikisource em português, Standard Ebooks and the Internet Archive — each
 * with its own deadline, so a slow source never holds the answer back. Only
 * public-domain / openly licensed books are returned: the Internet Archive
 * query excludes its lending collections.
 *
 * Downloads are proxied (most sources don't allow browser downloads) and
 * streamed straight through.
 */

import {
  cleanTitle,
  niceAuthor,
  parseWikisource,
  rankCatalog,
  type CatalogBook,
  type CatalogSource,
} from "@/lib/catalog-shared";

export type { CatalogBook, CatalogSource };

const UA = "BookVerse/1.0 (+https://bookverse-zenith.vercel.app)";
const DEADLINE_MS = 6500;

async function fetchJson<T>(url: string, ms = DEADLINE_MS): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, ms = DEADLINE_MS): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const LANG: Record<string, string> = {
  por: "pt",
  portuguese: "pt",
  eng: "en",
  english: "en",
  spa: "es",
  spanish: "es",
  fre: "fr",
  fra: "fr",
  french: "fr",
};
const lang2 = (v?: string | string[] | null) => {
  const raw = (Array.isArray(v) ? v[0] : v)?.toLowerCase().trim();
  if (!raw) return null;
  return LANG[raw] ?? raw.slice(0, 2);
};

export const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();

/* ------------------------------ sources ------------------------------ */

interface GutendexBook {
  id: number;
  title: string;
  authors: { name: string }[];
  languages: string[];
  formats: Record<string, string>;
  download_count: number;
}

async function searchGutenbergDex(q: string): Promise<CatalogBook[]> {
  const data = await fetchJson<{ results: GutendexBook[] }>(
    `https://gutendex.com/books?search=${encodeURIComponent(q)}`,
    11000,
  );
  return (data?.results ?? []).slice(0, 16).map((b) => ({
    key: `gutenberg:${b.id}`,
    source: "gutenberg",
    id: String(b.id),
    title: cleanTitle(
      b.title.split(/[:;]/)[0]!,
      b.authors?.[0] ? niceAuthor(b.authors[0].name) : "",
    ),
    author: b.authors?.[0] ? niceAuthor(b.authors[0].name) : "Autor desconhecido",
    language: b.languages?.[0] ?? null,
    cover: b.formats["image/jpeg"] ?? null,
    readerId: `gutenberg-${b.id}`,
    downloads: b.download_count,
  }));
}

/**
 * Gutenberg's own OPDS search — used alongside Gutendex, which often turns
 * cloud servers away. Entries look like:
 *   <entry><title>Dom Casmurro</title><content>Machado de Assis</content>
 *   <id>https://www.gutenberg.org/ebooks/55752.opds</id>…</entry>
 */
async function searchGutenbergOpds(q: string): Promise<CatalogBook[]> {
  const xml = await fetchText(
    `https://www.gutenberg.org/ebooks/search.opds/?query=${encodeURIComponent(q)}`,
    9000,
  );
  if (!xml) return [];
  const out: CatalogBook[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = m[1]!;
    const id = block.match(/\/ebooks\/(\d+)(?=[./"<?]|$)/)?.[1];
    if (!id) continue; // navigation entries ("sort by…")
    const title = decode(block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const rawAuthor = decode(block.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? "");
    if (!title) continue;
    const author = rawAuthor ? niceAuthor(rawAuthor) : "Autor desconhecido";
    out.push({
      key: `gutenberg:${id}`,
      source: "gutenberg",
      id,
      title: cleanTitle(title.split(/[:;]/)[0]!, author),
      author,
      language: null,
      cover: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
      readerId: `gutenberg-${id}`,
    });
    if (out.length >= 16) break;
  }
  return out;
}

/** Both Gutenberg searches at once; the first one with results wins. */
async function searchGutenberg(q: string): Promise<CatalogBook[]> {
  const dex = searchGutenbergDex(q);
  const opds = searchGutenbergOpds(q);
  const firstNonEmpty = await Promise.any(
    [dex, opds].map((p) => p.then((r) => (r.length ? r : Promise.reject(new Error("empty"))))),
  ).catch(() => [] as CatalogBook[]);
  return firstNonEmpty;
}

async function searchWikisource(q: string): Promise<CatalogBook[]> {
  const data = await fetchJson<Parameters<typeof parseWikisource>[0]>(
    `https://pt.wikisource.org/w/api.php?action=query&list=search&srnamespace=0&srlimit=14&format=json&srsearch=${encodeURIComponent(q)}`,
  );
  return data ? parseWikisource(data) : [];
}

async function searchStandard(q: string): Promise<CatalogBook[]> {
  const html = await fetchText(
    `https://standardebooks.org/ebooks?query=${encodeURIComponent(q)}&per-page=12`,
  );
  if (!html) return [];
  const out: CatalogBook[] = [];
  const re = /<li[^>]*typeof="schema:Book"[^>]*about="\/ebooks\/([^"]+)"[\s\S]*?<\/li>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 10) {
    const block = m[0];
    const path = m[1]!;
    const names = [...block.matchAll(/property="schema:name"[^>]*>([^<]+)</g)].map((x) =>
      decode(x[1]!),
    );
    const img = block.match(/<img[^>]+src="([^"]+)"/)?.[1];
    out.push({
      key: `standard:${path}`,
      source: "standard",
      id: path,
      title: names[0] ?? path.split("/").pop()!.replace(/-/g, " "),
      author: names[1] ?? path.split("/")[0]!.replace(/-/g, " "),
      language: "en",
      cover: img ? new URL(img, "https://standardebooks.org").toString() : null,
    });
  }
  return out;
}

interface ArchiveDoc {
  identifier: string;
  title?: string;
  creator?: string | string[];
  year?: number | string;
  language?: string | string[];
  downloads?: number;
}

async function searchArchive(q: string): Promise<CatalogBook[]> {
  const query = [
    `(${q})`,
    "mediatype:texts",
    "format:EPUB",
    // Never the lending library: only public domain / open licences.
    "NOT collection:(inlibrary OR printdisabled OR lendinglibrary OR internetarchivebooks)",
    "(year:[1000 TO 1929] OR licenseurl:*publicdomain* OR licenseurl:*creativecommons*)",
  ].join(" AND ");
  const fields = ["identifier", "title", "creator", "year", "language", "downloads"]
    .map((f) => `fl[]=${f}`)
    .join("&");
  const data = await fetchJson<{ response?: { docs: ArchiveDoc[] } }>(
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&${fields}&rows=12&sort[]=downloads+desc&output=json`,
  );
  return (data?.response?.docs ?? []).map((d) => {
    const author = niceAuthor(
      (Array.isArray(d.creator) ? d.creator[0] : d.creator) ?? "Autor desconhecido",
    );
    return {
      key: `archive:${d.identifier}`,
      source: "archive" as const,
      id: d.identifier,
      title: cleanTitle((d.title ?? d.identifier).slice(0, 140), author),
      author,
      year: d.year ? Number(d.year) || null : null,
      language: lang2(d.language),
      cover: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
      downloads: d.downloads ?? null,
    };
  });
}

/* ------------------------------ search ------------------------------- */

export async function searchCatalog(
  q: string,
  opts: { lang?: string | null; sources?: CatalogSource[] } = {},
): Promise<{ results: CatalogBook[]; sources: Record<CatalogSource, "ok" | "empty" | "skipped"> }> {
  const want = new Set<CatalogSource>(
    opts.sources?.length ? opts.sources : ["gutenberg", "wikisource", "standard", "archive"],
  );
  const run = async (s: CatalogSource, fn: (q: string) => Promise<CatalogBook[]>) =>
    want.has(s) ? fn(q).catch(() => []) : null;
  const [g, w, st, a] = await Promise.all([
    run("gutenberg", searchGutenberg),
    run("wikisource", searchWikisource),
    run("standard", searchStandard),
    run("archive", searchArchive),
  ]);
  const sources = {
    gutenberg: g === null ? "skipped" : g.length ? "ok" : "empty",
    wikisource: w === null ? "skipped" : w.length ? "ok" : "empty",
    standard: st === null ? "skipped" : st.length ? "ok" : "empty",
    archive: a === null ? "skipped" : a.length ? "ok" : "empty",
  } as const;

  const all = [...(g ?? []), ...(w ?? []), ...(st ?? []), ...(a ?? [])];
  const results = rankCatalog(all, q, opts.lang);
  return { results, sources };
}

/* ----------------------------- downloads ----------------------------- */

/** Where a book's EPUB actually lives. */
export async function resolveEpubUrl(source: CatalogSource, id: string): Promise<string | null> {
  switch (source) {
    case "gutenberg":
      if (!/^\d+$/.test(id)) return null;
      return `https://www.gutenberg.org/ebooks/${id}.epub3.images`;
    case "wikisource":
      return `https://ws-export.wmcloud.org/?lang=pt&format=epub&page=${encodeURIComponent(id.replace(/ /g, "_"))}`;
    case "standard": {
      if (!/^[a-z0-9-]+(\/[a-z0-9-]+)+$/.test(id)) return null;
      const slug = id.replace(/\//g, "_");
      return `https://standardebooks.org/ebooks/${id}/downloads/${slug}.epub?source=download`;
    }
    case "archive": {
      if (!/^[\w.-]+$/.test(id)) return null;
      const meta = await fetchJson<{ files?: { name: string; format?: string; size?: string }[] }>(
        `https://archive.org/metadata/${encodeURIComponent(id)}`,
      );
      const epub = meta?.files?.find((f) => f.name.toLowerCase().endsWith(".epub"));
      return epub
        ? `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(epub.name)}`
        : null;
    }
  }
}

const MAX_BYTES = 80 * 1024 * 1024;

/** Gutenberg's main site sometimes refuses cloud servers; mirrors don't. */
function gutenbergMirrors(id: string): string[] {
  return [
    `https://www.gutenberg.org/ebooks/${id}.epub3.images`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}-images-3.epub`,
    `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}-images-3.epub`,
    `https://aleph.pglaf.org/cache/epub/${id}/pg${id}-images-3.epub`,
  ];
}

export async function proxyEpub(source: CatalogSource, id: string): Promise<Response> {
  const first = await resolveEpubUrl(source, id);
  if (!first)
    return Response.json({ error: "Este livro não tem EPUB disponível." }, { status: 404 });
  // Wikisource builds the EPUB on demand, so it gets more time to start.
  const headerTimeout = {
    wikisource: 45_000,
    archive: 25_000,
    standard: 15_000,
    gutenberg: 12_000,
  }[source];
  if (source !== "gutenberg") return proxyOne(first, new AbortController(), headerTimeout);
  const res = await raceMirrors(gutenbergMirrors(id));
  // Heavily illustrated editions (20 MB+) are slow on phones: the
  // text-only edition opens in a second and reads the same. When the size
  // isn't announced we can't tell, so the light edition wins too.
  const len = Number(res.headers.get("content-length") ?? 0);
  if (res.ok && (!len || len > 12 * 1024 * 1024)) {
    const light = await raceMirrors(gutenbergLightMirrors(id));
    if (light.ok) {
      void res.body?.cancel().catch(() => {});
      return light;
    }
  }
  return res;
}

/** Text-only editions (no illustrations) — a fraction of the size. */
function gutenbergLightMirrors(id: string): string[] {
  return [
    `https://www.gutenberg.org/ebooks/${id}.epub.noimages`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.epub`,
    `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.epub`,
    `https://aleph.pglaf.org/cache/epub/${id}/pg${id}.epub`,
  ];
}

/**
 * Starts the mirrors a moment apart and keeps whichever answers first
 * (the slow or refusing ones are cancelled), instead of waiting for each
 * to time out in turn.
 */
async function raceMirrors(urls: string[]): Promise<Response> {
  const ctrls = urls.map(() => new AbortController());
  let last: Response | null = null;
  let won = false;
  try {
    return await Promise.any(
      urls.map(async (url, i) => {
        await new Promise((r) => setTimeout(r, i * 700));
        if (ctrls[i]!.signal.aborted) throw new Error("cancelled");
        const res = await proxyOne(url, ctrls[i]!);
        if (!res.ok || won) {
          if (!res.ok) last = res;
          else ctrls[i]!.abort();
          throw new Error("mirror failed");
        }
        won = true;
        ctrls.forEach((c, k) => k !== i && c.abort());
        return res;
      }),
    );
  } catch {
    return (
      last ?? Response.json({ error: "A fonte demorou demais para responder." }, { status: 504 })
    );
  }
}

async function proxyOne(
  url: string,
  ctrl = new AbortController(),
  headerTimeout = 12_000,
): Promise<Response> {
  // Give up on a source that hasn't even started answering in time.
  const timer = setTimeout(() => ctrl.abort(), headerTimeout);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA },
    });
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok || !r.body || /text\/html|xhtml/.test(type)) {
      return Response.json(
        { error: "A fonte não entregou o arquivo agora. Tente de novo em instantes." },
        { status: 502 },
      );
    }
    const len = Number(r.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) {
      return Response.json(
        { error: "Esta edição é um escaneamento grande demais para o celular. Tente outra fonte." },
        { status: 413 },
      );
    }
    return new Response(r.body, {
      headers: {
        "Content-Type": "application/epub+zip",
        ...(len ? { "Content-Length": String(len) } : {}),
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch {
    return Response.json({ error: "A fonte demorou demais para responder." }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
