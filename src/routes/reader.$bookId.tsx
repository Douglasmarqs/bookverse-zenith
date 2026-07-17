import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  Settings2,
  Cloud,
  CloudOff,
  Sparkles,
} from "lucide-react";

import { SAMPLE_BOOK, type Book } from "@/lib/sample-book";
import { getPublicDomainBook, parseGutenbergReaderId } from "@/lib/public-domain";
import {
  loadProgressRemote,
  loadSettings,
  saveProgress,
  saveSettings,
  DEFAULT_SETTINGS,
  type ReaderSettings,
  type ReadingProgress,
} from "@/lib/reader-store";
import { ReaderSettingsPanel } from "@/components/reader/settings-panel";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { awardXp, incrementBooksCompleted } from "@/lib/user-profile";
import { markAsReading, setLibraryStatus, slugFor } from "@/lib/library";

export const Route = createFileRoute("/reader/$bookId")({
  head: () => ({
    meta: [
      { title: "Leitor — BookVerse" },
      {
        name: "description",
        content: "Experiência de leitura imersiva, personalizável e sincronizada.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({
    params,
  }): { source: "sample"; book: Book } | { source: "gutenberg"; gutenbergId: number } => {
    if (params.bookId === SAMPLE_BOOK.id) return { source: "sample", book: SAMPLE_BOOK };
    const gutenbergId = parseGutenbergReaderId(params.bookId);
    if (gutenbergId !== null) return { source: "gutenberg", gutenbergId };
    throw notFound();
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-6 py-32 text-center">
      <h2 className="font-display text-3xl">Livro não encontrado</h2>
      <p className="mt-3 text-muted-foreground">
        Este título não está disponível em sua biblioteca.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Voltar
      </Link>
    </div>
  ),
  component: GuardedReaderPage,
});

function GuardedReaderPage() {
  const { state, user } = useRequireAuth();
  const loaderData = Route.useLoaderData();

  if (state !== "authenticated" || !user) {
    return (
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-md place-items-center px-6 text-center">
        <div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <p className="mt-4 text-sm text-muted-foreground">
            {state === "loading" ? "Verificando sua sessão…" : "Redirecionando para o login…"}
          </p>
        </div>
      </div>
    );
  }

  if (loaderData.source === "sample") {
    return <ReaderPage uid={user.uid} book={loaderData.book} />;
  }
  return <GutenbergBookLoader uid={user.uid} gutenbergId={loaderData.gutenbergId} />;
}

function GutenbergBookLoader({ uid, gutenbergId }: { uid: string; gutenbergId: number }) {
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBook(null);
    setError(null);
    getPublicDomainBook(gutenbergId)
      .then((b) => {
        if (!cancelled) setBook(b);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[reader] failed to load public domain book", err);
          setError(
            err instanceof Error ? err.message : "Não foi possível carregar este livro agora.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gutenbergId]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <h2 className="font-display text-3xl">Não foi possível abrir este livro</h2>
        <p className="mt-3 text-muted-foreground">{error}</p>
        <Link
          to="/descobrir"
          search={{ q: undefined, categoria: undefined }}
          className="mt-6 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Voltar a Descobrir
        </Link>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-md place-items-center px-6 text-center">
        <div>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
          <p className="mt-4 text-sm text-muted-foreground">Baixando o livro…</p>
        </div>
      </div>
    );
  }

  return <ReaderPage uid={uid} book={book} />;
}

const THEME_STYLES = {
  light: {
    bg: "#F7F1E6",
    fg: "#1F1B16",
    muted: "#7A6E5E",
    accent: "#8B5E34",
    rule: "rgba(31,27,22,0.12)",
  },
  sepia: {
    bg: "#EFE4D0",
    fg: "#3A2818",
    muted: "#7A5B3E",
    accent: "#8B5E34",
    rule: "rgba(58,40,24,0.14)",
  },
  dark: {
    bg: "#0E0B08",
    fg: "#E8DFD3",
    muted: "#9C907E",
    accent: "#C89B6A",
    rule: "rgba(232,223,211,0.12)",
  },
} as const;

function ReaderPage({ uid, book }: { uid: string; book: Book }) {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [scrollRatio, setScrollRatio] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [saved, setSaved] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Opening a book counts as "starting" it — track it in the library so it
  // shows up under "Minha biblioteca" / "Continue lendo" and can be resumed.
  useEffect(() => {
    void markAsReading(uid, { title: book.title, author: book.author, cover: book.cover }, book.id);
  }, [uid, book.id, book.title, book.author, book.cover]);

  // Hydrate settings + progress after mount (avoid SSR mismatch).
  useEffect(() => {
    setSettings(loadSettings());
    void loadProgressRemote(book.id).then((p) => {
      if (p) {
        setChapterIndex(Math.min(p.chapterIndex, book.chapters.length - 1));
        requestAnimationFrame(() => {
          const el = contentRef.current;
          if (el) el.scrollTop = p.scrollRatio * (el.scrollHeight - el.clientHeight);
        });
      }
      setHydrated(true);
    });
  }, [book.id, book.chapters.length]);

  // Persist settings.
  useEffect(() => {
    if (!hydrated) return;
    saveSettings(settings);
  }, [settings, hydrated]);

  // Debounced progress save.
  const queueSave = useCallback(
    (progress: ReadingProgress) => {
      setSaved(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveProgress(book.id, progress);
        setSaved(true);
      }, 600);
    },
    [book.id],
  );

  const onScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const denom = el.scrollHeight - el.clientHeight;
    const r = denom > 0 ? el.scrollTop / denom : 0;
    setScrollRatio(r);
    queueSave({ chapterIndex, scrollRatio: r, updatedAt: Date.now() });
  }, [chapterIndex, queueSave]);

  const goto = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(book.chapters.length - 1, i));
      if (clamped > chapterIndex) {
        void awardXp(uid, 20);
        if (clamped === book.chapters.length - 1) {
          void incrementBooksCompleted(uid);
          void setLibraryStatus(uid, slugFor(book.title, book.author), "concluido");
        }
      }
      setChapterIndex(clamped);
      setScrollRatio(0);
      requestAnimationFrame(() => {
        const el = contentRef.current;
        if (el) el.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      });
      queueSave({ chapterIndex: clamped, scrollRatio: 0, updatedAt: Date.now() });
      setTocOpen(false);
    },
    [book.chapters.length, book.title, book.author, chapterIndex, queueSave, uid],
  );

  const theme = THEME_STYLES[settings.theme];
  const chapter = book.chapters[chapterIndex];

  const overallProgress = useMemo(() => {
    const per = 1 / book.chapters.length;
    return Math.min(1, chapterIndex * per + scrollRatio * per);
  }, [book.chapters.length, chapterIndex, scrollRatio]);

  const readerFontFamily = settings.font === "serif" ? "var(--font-display)" : "var(--font-sans)";

  const contentStyle: React.CSSProperties =
    settings.mode === "paginated"
      ? {
          columnWidth: `${settings.maxWidth}ch`,
          columnGap: "4rem",
          columnFill: "auto",
          height: "100%",
          overflowY: "hidden",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          padding: `2rem ${settings.margin}px`,
        }
      : {
          overflowY: "auto",
          padding: `3rem ${settings.margin}px 8rem`,
        };

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col"
      style={{ backgroundColor: theme.bg, color: theme.fg }}
    >
      {/* Top bar */}
      <header
        className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6"
        style={{ borderColor: theme.rule }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:opacity-70"
            style={{ color: theme.fg }}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-medium">{book.title}</p>
            <p className="truncate text-[11px]" style={{ color: theme.muted }}>
              {book.author}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span
            className="mr-1 hidden items-center gap-1 text-[11px] sm:inline-flex"
            style={{ color: theme.muted }}
            title={saved ? "Sincronizado" : "Salvando..."}
          >
            {saved ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            {saved ? "Salvo" : "Salvando..."}
          </span>
          <IconBtn theme={theme} onClick={() => setTocOpen(true)} label="Sumário">
            <List className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            theme={theme}
            onClick={() =>
              openLumiPanel({
                bookTitle: book.title,
                bookAuthor: book.author,
                chapterTitle: chapter.title,
                chapterExcerpt: chapter.paragraphs.slice(0, 3).join(" "),
              })
            }
            label="Perguntar à Lumi"
          >
            <Sparkles className="h-4 w-4" />
          </IconBtn>
          <IconBtn theme={theme} onClick={() => setPanelOpen(true)} label="Ajustes">
            <Settings2 className="h-4 w-4" />
          </IconBtn>
        </div>
      </header>

      {/* Content */}
      <div
        ref={contentRef}
        onScroll={settings.mode === "scroll" ? onScroll : undefined}
        style={contentStyle}
        className="flex-1"
      >
        <article
          className="mx-auto"
          style={{
            maxWidth: settings.mode === "paginated" ? "none" : `${settings.maxWidth}ch`,
            fontFamily: readerFontFamily,
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            color: theme.fg,
          }}
        >
          <header className="mb-10">
            <p
              className="text-[11px] uppercase tracking-[0.25em]"
              style={{ color: theme.accent, fontFamily: "var(--font-sans)" }}
            >
              Capítulo {chapterIndex + 1} de {book.chapters.length}
            </p>
            <h1
              className="mt-3 font-display text-3xl font-medium md:text-4xl"
              style={{ color: theme.fg }}
            >
              {chapter.title}
            </h1>
            <div
              className="mt-6 h-px w-16"
              style={{ backgroundColor: theme.accent, opacity: 0.7 }}
            />
          </header>

          {chapter.paragraphs.map((p: string, i: number) => (
            <p key={i} className="mb-6 [text-align:justify] [hyphens:auto]">
              {p}
            </p>
          ))}

          {/* Chapter nav */}
          <nav
            className="mt-16 flex items-center justify-between border-t pt-6"
            style={{ borderColor: theme.rule, fontFamily: "var(--font-sans)" }}
          >
            <button
              onClick={() => goto(chapterIndex - 1)}
              disabled={chapterIndex === 0}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition disabled:opacity-30"
              style={{ borderColor: theme.rule, color: theme.fg }}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button
              onClick={() => goto(chapterIndex + 1)}
              disabled={chapterIndex === book.chapters.length - 1}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-30"
              style={{ backgroundColor: theme.accent, color: theme.bg }}
            >
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </article>
      </div>

      {/* Progress rail */}
      <div
        className="border-t px-4 py-2.5 md:px-6"
        style={{ borderColor: theme.rule, fontFamily: "var(--font-sans)" }}
      >
        <div className="flex items-center gap-3 text-[11px]" style={{ color: theme.muted }}>
          <span className="tabular-nums">{Math.round(overallProgress * 100)}%</span>
          <div
            className="h-1 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: theme.rule }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{ width: `${overallProgress * 100}%`, backgroundColor: theme.accent }}
            />
          </div>
          <span className="tabular-nums">
            Cap. {chapterIndex + 1}/{book.chapters.length}
          </span>
        </div>
      </div>

      {/* Settings panel */}
      <ReaderSettingsPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        settings={settings}
        onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
      />

      {/* Table of contents */}
      {tocOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setTocOpen(false)}
          />
          <aside
            className="fixed left-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-r shadow-2xl"
            style={{ backgroundColor: theme.bg, color: theme.fg, borderColor: theme.rule }}
          >
            <div className="border-b px-5 py-4" style={{ borderColor: theme.rule }}>
              <p
                className="text-[11px] uppercase tracking-[0.25em]"
                style={{ color: theme.accent }}
              >
                Sumário
              </p>
              <h3 className="mt-1 font-display text-lg font-medium">{book.title}</h3>
            </div>
            <ul className="flex-1 overflow-y-auto p-3">
              {book.chapters.map((c: (typeof book.chapters)[number], i: number) => {
                const active = i === chapterIndex;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => goto(i)}
                      className="w-full rounded-xl px-4 py-3 text-left transition"
                      style={{
                        backgroundColor: active ? theme.accent + "22" : "transparent",
                        color: active ? theme.accent : theme.fg,
                      }}
                    >
                      <span className="text-[10px] tabular-nums" style={{ color: theme.muted }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="ml-3 font-display">{c.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        </>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  theme,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  theme: (typeof THEME_STYLES)[keyof typeof THEME_STYLES];
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full transition hover:opacity-70"
      style={{ color: theme.fg }}
    >
      {children}
    </button>
  );
}
