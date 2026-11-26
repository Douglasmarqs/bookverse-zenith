import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  BookmarkCheck,
  BookmarkPlus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Ellipsis,
  Headphones,
  Loader2,
  Share,
} from "lucide-react";
import { toast } from "sonner";
import type { User } from "firebase/auth";

import { BookArt } from "@/components/book-art";
import { BookReviews } from "@/components/book-reviews";
import { LumiAskBar } from "@/components/lumi-ask-bar";
import { LangTag } from "@/components/lang-tag";
import { flyToLibrary, playBookOpen } from "@/lib/book-motion";
import { formatMinutes } from "@/components/home/home-screen";
import { describeFirestoreError } from "@/lib/async-utils";
import {
  SOURCE_LABEL,
  downloadBook,
  downloadedReaderId,
  searchCatalog,
  useDownloads,
  type CatalogBook,
  type CatalogSource,
} from "@/lib/catalog";
import { norm } from "@/lib/catalog-shared";
import { COLLECTIONS } from "@/lib/collections";
import { LUMI_PICKS } from "@/lib/editorial";
import { bookPalette } from "@/lib/faux-books";
import { subscribeAuth } from "@/lib/firebase";
import { fetchBookMeta, type BookMeta } from "@/lib/google-books";
import { addToLibrary, slugFor, subscribeLibrary, type LibraryEntry } from "@/lib/library";

const SOURCES: CatalogSource[] = ["gutenberg", "wikisource", "standard", "archive"];

export const Route = createFileRoute("/livro/$slug")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { title: string; author?: string; source?: CatalogSource; id?: string; cover?: string } => ({
    title: typeof search.title === "string" ? search.title : "",
    author: typeof search.author === "string" ? search.author : undefined,
    source: SOURCES.includes(search.source as CatalogSource)
      ? (search.source as CatalogSource)
      : undefined,
    id: typeof search.id === "string" ? search.id : undefined,
    cover: typeof search.cover === "string" ? search.cover : undefined,
  }),
  head: ({ match }) => {
    const title =
      (match.search as { title?: string })?.title ||
      resolveSlug((match.params as { slug?: string })?.slug ?? "").title;
    return {
      meta: [
        { title: `${title} — BookVerse` },
        { name: "description", content: `Leia ou ouça "${title}" grátis no BookVerse.` },
        { property: "og:title", content: `${title} — BookVerse` },
      ],
    };
  },
  component: BookPage,
});

/**
 * A shared or typed link may carry only the slug (/livro/dom-casmurro).
 * Recover the real title/author from our curated lists, or un-slug it.
 */
function resolveSlug(slug: string): { title: string; author: string } {
  const s = decodeURIComponent(slug || "").toLowerCase();
  if (!s) return { title: "Livro", author: "" };
  const known: { title: string; author: string }[] = [
    ...COLLECTIONS.flatMap((c) => c.books.map((b) => ({ title: b.title, author: b.author ?? "" }))),
    ...LUMI_PICKS.map((p) => ({ title: p.title, author: p.author })),
  ];
  const hit =
    known.find((b) => slugFor(b.title, b.author || undefined) === s) ??
    known.find((b) => slugFor(b.title) === s) ??
    known.find((b) => s.startsWith(slugFor(b.title) + "-"));
  if (hit) return hit;
  const words = s.split("-").filter(Boolean);
  const small = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "o",
    "a",
    "os",
    "as",
    "no",
    "na",
    "em",
  ]);
  return {
    title: words
      .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" "),
    author: "",
  };
}

/** Known reading times from our curated lists. */
function knownMinutes(title: string): number | null {
  const n = norm(title);
  for (const c of COLLECTIONS)
    for (const b of c.books) if (norm(b.title) === n && b.minutes) return b.minutes;
  return LUMI_PICKS.find((p) => norm(p.title) === n)?.minutes ?? null;
}

function BookPage() {
  const search = Route.useSearch();
  const { slug } = Route.useParams();
  const fromSlug = useMemo(() => (search.title ? null : resolveSlug(slug)), [search.title, slug]);
  const title = search.title || fromSlug?.title || "Livro";
  const author = search.author ?? fromSlug?.author ?? "";
  const { source, id, cover } = search;
  const navigate = useNavigate();
  const router = useRouter();
  const [meta, setMeta] = useState<BookMeta | null | undefined>(undefined);
  const [copy, setCopy] = useState<CatalogBook | null | undefined>(
    source && id
      ? {
          key: `${source}:${id}`,
          source,
          id,
          title,
          author,
          cover: cover ?? null,
          readerId: source === "gutenberg" ? `gutenberg-${id}` : null,
        }
      : undefined,
  );
  const [others, setOthers] = useState<CatalogBook[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [tab, setTab] = useState<"sobre" | "fontes" | "avaliacoes">("sobre");
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const downloads = useDownloads();

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => {
    if (!user || user.isAnonymous) return setLibrary([]);
    return subscribeLibrary(user.uid, setLibrary);
  }, [user]);

  useEffect(() => {
    let alive = true;
    setMeta(undefined);
    fetchBookMeta(title, author || undefined)
      .then((m) => alive && setMeta(m))
      .catch(() => alive && setMeta(null));
    return () => {
      alive = false;
    };
  }, [title, author]);

  // Every free copy of this book across the sources.
  useEffect(() => {
    let alive = true;
    // Never leave "Procurando…" spinning if a source hangs.
    const giveUp = setTimeout(
      () => alive && setCopy((prev) => (prev === undefined ? null : prev)),
      12000,
    );
    void searchCatalog(`${title} ${author.split(" ").slice(-1)[0] ?? ""}`.trim()).then((r) => {
      if (!alive) return;
      const nt = norm(title);
      const matches = r.filter((b) => {
        const t = norm(b.title);
        return t === nt || t.startsWith(nt) || nt.startsWith(t);
      });
      setOthers(matches);
      setCopy((prev) => prev ?? matches.find((m) => m.readerId) ?? matches[0] ?? null);
    });
    return () => {
      alive = false;
      clearTimeout(giveUp);
    };
  }, [title, author]);

  const pal = bookPalette(title, author);
  const bookId = slugFor(title, author || undefined);
  const entry = useMemo(() => library.find((e) => e.id === bookId), [bookId, library]);
  const state = copy ? downloads.get(copy.key) : undefined;
  const local = copy
    ? state?.state === "done"
      ? state.readerId
      : downloadedReaderId(copy.key)
    : null;
  const readerId = local ?? copy?.readerId ?? entry?.readerId ?? meta?.readerId ?? null;
  const busy = state?.state === "downloading" || state?.state === "preparing";
  const minutes = knownMinutes(title);
  const pages = minutes ? Math.round(minutes / 1.1) : null;
  const description = meta?.description?.replace(/<[^>]+>/g, "");
  const categories = (meta?.categories ?? []).slice(0, 4);
  const realCover = cover ?? meta?.cover ?? copy?.cover ?? null;

  async function open(listen = false) {
    if (readerId && !listen)
      playBookOpen(document.querySelector<HTMLElement>(".book3d-body > :first-child"));
    let rid = readerId;
    if (!rid) {
      if (!copy) {
        toast.error("Ainda procurando uma cópia grátis deste livro…");
        return;
      }
      try {
        rid = await downloadBook(copy);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível baixar agora.");
        return;
      }
    }
    void navigate({
      to: "/reader/$bookId",
      params: { bookId: rid },
      search: (listen ? { ouvir: 1 } : {}) as never,
    });
  }

  async function save() {
    if (!user || user.isAnonymous) {
      void navigate({
        to: "/auth",
        search: { redirect: window.location.pathname + window.location.search },
      });
      return;
    }
    setSaving(true);
    try {
      await addToLibrary(
        user.uid,
        {
          title,
          author: author || meta?.author || "Autor desconhecido",
          cover: realCover,
          readerId,
        },
        "quero-ler",
      );
      flyToLibrary(document.querySelector(".book3d"));
      toast.success("Salvo na sua biblioteca.");
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar agora."));
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share)
        await navigator.share({ title, text: `Leia "${title}" grátis no BookVerse`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado.");
      }
    } catch {
      // cancelled
    }
  }

  const stats: [string, string][] = [
    meta?.averageRating
      ? [
          `★ ${meta.averageRating.toFixed(1).replace(".", ",")}`,
          meta.ratingsCount ? `${meta.ratingsCount} notas` : "avaliação",
        ]
      : ["★ —", "sem notas"],
    [minutes ? formatMinutes(minutes) : "—", "de leitura"],
    [
      pages ? String(pages) : copy ? SOURCE_LABEL[copy.source].split(" ").pop()! : "—",
      pages ? "páginas" : "fonte",
    ],
    ["Grátis", "domínio público"],
  ];

  return (
    <div className="relative min-h-screen pb-12">
      {/* Cover-coloured top */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[470px] lg:h-[520px]"
        style={{
          background: `linear-gradient(180deg, ${pal.bg} 0%, ${pal.bg} 58%, var(--ink) 100%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-20 h-80"
        style={{
          background: `radial-gradient(closest-side, color-mix(in oklab, ${pal.accent} 33%, transparent), transparent)`,
        }}
      />

      <div className="relative mx-auto max-w-3xl">
        <div
          className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:pt-8"
          style={{ color: pal.fg }}
        >
          <button
            type="button"
            onClick={() =>
              window.history.length > 1
                ? router.history.back()
                : void navigate({ to: "/descobrir", search: {} })
            }
            aria-label="Voltar"
            className="press grid h-[42px] w-[42px] place-items-center rounded-full bg-white/[.14]"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void share()}
              aria-label="Compartilhar"
              className="press grid h-[42px] w-[42px] place-items-center rounded-full bg-white/[.14]"
            >
              <Share className="h-[19px] w-[19px]" />
            </button>
            <Link
              to="/descobrir"
              search={{ q: author || title }}
              aria-label="Mais deste autor"
              className="press grid h-[42px] w-[42px] place-items-center rounded-full bg-white/[.14]"
            >
              <Ellipsis className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0.55, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-2 w-40 lg:w-48"
        >
          <BookArt title={title} author={author} cover={realCover} lift eager live />
        </motion.div>

        <div className="mt-5 px-6 text-center">
          <h1 className="text-[32px] leading-none lg:text-[40px]">{title}</h1>
          {author && (
            <Link
              to="/descobrir"
              search={{ q: author }}
              className="mt-1.5 inline-flex items-center gap-1 text-[15px] font-semibold text-gold"
            >
              {author} <ChevronRight className="h-[15px] w-[15px]" strokeWidth={2.4} />
            </Link>
          )}
        </div>

        <div className="surface-card mx-4 mt-[18px] flex rounded-[22px] py-3.5">
          {stats.map(([v, l], i) => (
            <div key={l} className={`flex-1 text-center ${i ? "border-l border-border" : ""}`}>
              <p className="truncate px-1 font-display text-base">{v}</p>
              <p className="mt-1 truncate px-1 text-[11px] text-faint">{l}</p>
            </div>
          ))}
        </div>

        <div className="mx-4 mt-3.5 flex gap-2.5">
          <button
            type="button"
            onClick={() => void open()}
            disabled={busy || copy === undefined}
            className="btn-primary h-[54px] min-w-0 flex-1 text-base disabled:opacity-70"
          >
            {busy ? (
              <>
                <Loader2 className="h-[19px] w-[19px] animate-spin" />
                {state?.state === "downloading"
                  ? `Baixando ${Math.round(state.progress * 100)}%`
                  : "Preparando…"}
              </>
            ) : copy === undefined ? (
              <>
                <Loader2 className="h-[19px] w-[19px] shrink-0 animate-spin" />
                <span className="truncate">Procurando…</span>
              </>
            ) : (
              <>
                <BookOpen className="h-[19px] w-[19px]" strokeWidth={2.2} /> Ler agora
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void open(true)}
            disabled={busy || (!copy && !readerId)}
            className="btn-ghost h-[54px] shrink-0 px-5 disabled:opacity-60"
          >
            <Headphones className="h-[19px] w-[19px]" />{" "}
            <span className="hidden min-[380px]:inline">Ouvir</span>
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            aria-label={entry ? "Na sua biblioteca" : "Salvar na biblioteca"}
            className="btn-ghost h-[54px] w-[54px] shrink-0 px-0"
          >
            {entry ? (
              <BookmarkCheck className="h-5 w-5 text-gold" />
            ) : (
              <BookmarkPlus className="h-5 w-5" />
            )}
          </button>
        </div>
        {copy === null && (
          <p className="mx-6 mt-3 text-center text-[13px] text-muted-foreground">
            Não achamos uma cópia grátis deste livro. Se você tem o arquivo, importe-o na sua
            Biblioteca.
          </p>
        )}

        <div role="tablist" className="mx-[22px] mt-6 flex gap-[22px] border-b border-border">
          {(
            [
              ["sobre", "Sobre"],
              ["fontes", `Fontes${others.length ? ` · ${others.length}` : ""}`],
              ["avaliacoes", "Avaliações"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`pb-3 text-[14.5px] font-semibold ${tab === k ? "shadow-[inset_0_-2.5px_0_var(--parchment)]" : "text-faint"}`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === "sobre" && (
          <div className="px-[22px]">
            {meta === undefined ? (
              <div className="mt-4 space-y-2">
                {[1, 0.9, 0.95, 0.6].map((w, i) => (
                  <div
                    key={i}
                    className="h-3.5 animate-pulse rounded bg-secondary"
                    style={{ width: `${w * 100}%` }}
                  />
                ))}
              </div>
            ) : (
              <p
                className={`mt-4 text-[15px] leading-[1.55] text-muted-foreground ${expanded ? "" : "line-clamp-4"}`}
              >
                {description ||
                  `${title}${author ? `, de ${author},` : ""} é uma obra em domínio público: grátis e legal para ler, ouvir e baixar no BookVerse.`}
              </p>
            )}
            {description && description.length > 220 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-[15px] font-semibold"
              >
                {expanded ? "Menos" : "Mais"}
              </button>
            )}
            <div className="mt-3.5 flex flex-wrap gap-2">
              {copy?.language && (
                <LangTag code={copy.language} className="!px-3 !py-1.5 !text-xs" />
              )}
              {[...categories, copy ? SOURCE_LABEL[copy.source] : null, "Domínio público"]
                .filter(Boolean)
                .map((t) => (
                  <span
                    key={t!}
                    className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
            </div>
            <div className="mt-6 rounded-[24px] bg-accent-soft/60 p-3.5">
              <p className="mb-2.5 px-1 text-[13px] font-bold">Pergunte à Lumi sobre este livro</p>
              <LumiAskBar
                placeholder="Sua dúvida sobre o livro…"
                context={{ topic: "question", bookTitle: title, bookAuthor: author || undefined }}
                prefix={`Sobre o livro “${title}”${author ? `, de ${author}` : ""}: `}
                suggestions={[
                  "Do que trata, sem spoilers?",
                  "Vale a pena para quem está começando?",
                  "Qual o contexto histórico?",
                  "Quem são os personagens principais?",
                ]}
              />
            </div>
          </div>
        )}

        {tab === "fontes" && (
          <ul className="px-4">
            {others.length === 0 && (
              <li className="mt-6 text-center text-sm text-muted-foreground">
                {copy === undefined ? "Procurando nos acervos…" : "Nenhuma outra cópia encontrada."}
              </li>
            )}
            {others.map((b) => {
              const s = downloads.get(b.key);
              const ready =
                (s?.state === "done" ? s.readerId : downloadedReaderId(b.key)) ?? b.readerId;
              return (
                <li
                  key={b.key}
                  className="flex items-center gap-3 border-b border-border px-1.5 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">{SOURCE_LABEL[b.source]}</p>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                      {b.title} · {b.author}
                      {b.language ? ` · ${b.language.toUpperCase()}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={s?.state === "downloading" || s?.state === "preparing"}
                    onClick={async () => {
                      if (ready)
                        return void navigate({ to: "/reader/$bookId", params: { bookId: ready } });
                      try {
                        await downloadBook(b);
                        flyToLibrary(document.querySelector(".book3d"));
                        toast.success("Baixado — disponível offline.");
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Não foi possível baixar agora.",
                        );
                      }
                    }}
                    className="press inline-flex h-[38px] items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
                  >
                    {s?.state === "downloading" ? (
                      `${Math.round(s.progress * 100)}%`
                    ) : ready ? (
                      "Ler"
                    ) : (
                      <>
                        <Download className="h-[15px] w-[15px]" /> Baixar
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "avaliacoes" && (
          <div className="px-4 pt-2">
            <BookReviews bookId={bookId} user={user} />
          </div>
        )}
      </div>
    </div>
  );
}
