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
  Bookmark as BookmarkIcon,
  Highlighter,
  StickyNote,
  X as XIcon,
  Trash2,
  Share2,
  Languages,
} from "lucide-react";

import { getSampleBook, type Book } from "@/lib/sample-book";
import { getPublicDomainBook, parseGutenbergReaderId } from "@/lib/public-domain";
import {
  downloadEpubBookFromCloud,
  getEpubBook,
  isEpubReaderId,
  saveEpubBook,
} from "@/lib/epub-store";
import {
  downloadPdfBookFromCloud,
  ensurePdfBookText,
  getPdfBook,
  isPdfReaderId,
  savePdfBook,
  uploadPdfBookToCloud,
  type PdfBook,
} from "@/lib/pdf-store";
import {
  loadProgressRemote,
  loadSettings,
  loadSettingsRemote,
  saveProgress,
  saveSettings,
  saveSettingsRemote,
  DEFAULT_SETTINGS,
  type ReaderSettings,
  type ReadingProgress,
} from "@/lib/reader-store";
import {
  subscribeAnnotations,
  addHighlight,
  removeHighlight,
  updateHighlightColor,
  updateHighlightNote,
  addBookmark,
  removeBookmark,
  type BookAnnotations,
  type Highlight,
  type HighlightColor,
} from "@/lib/annotations";
import { ReaderSettingsPanel } from "@/components/reader/settings-panel";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { recordGamificationMilestone } from "@/lib/user-profile";
import { markAsReading, setLibraryStatus, slugFor } from "@/lib/library";
import { toast } from "sonner";
import { describeFirestoreError } from "@/lib/async-utils";
import { ReaderPageSkeleton } from "@/components/reader-page-skeleton";
import { PdfPageViewer } from "@/components/reader/pdf-page-viewer";

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
  }):
    | { source: "sample"; book: Book }
    | { source: "gutenberg"; gutenbergId: number }
    | { source: "epub"; localId: string }
    | { source: "pdf"; localId: string } => {
    const sample = getSampleBook(params.bookId);
    if (sample) return { source: "sample", book: sample };
    const gutenbergId = parseGutenbergReaderId(params.bookId);
    if (gutenbergId !== null) return { source: "gutenberg", gutenbergId };
    if (isEpubReaderId(params.bookId)) return { source: "epub", localId: params.bookId };
    if (isPdfReaderId(params.bookId)) return { source: "pdf", localId: params.bookId };
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
  if (loaderData.source === "epub") {
    return <EpubBookLoader uid={user.uid} localId={loaderData.localId} />;
  }
  if (loaderData.source === "pdf") {
    return <PdfBookLoader uid={user.uid} localId={loaderData.localId} />;
  }
  return <GutenbergBookLoader uid={user.uid} gutenbergId={loaderData.gutenbergId} />;
}

function EpubBookLoader({ uid, localId }: { uid: string; localId: string }) {
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"local" | "cloud">("local");

  useEffect(() => {
    let cancelled = false;
    setBook(null);
    setError(null);
    setStage("local");

    async function load() {
      const local = await getEpubBook(localId).catch((err) => {
        console.warn("[reader] failed to read local epub store", err);
        return null;
      });
      if (cancelled) return;
      if (local) {
        setBook(local);
        return;
      }
      // Not on this device/browser — it may have been imported elsewhere
      // and synced to Firebase Storage; fetch and cache it locally too.
      setStage("cloud");
      const cloudBook = await downloadEpubBookFromCloud(uid, localId);
      if (cancelled) return;
      if (cloudBook) {
        setBook(cloudBook);
        void saveEpubBook(cloudBook).catch(() => {});
        return;
      }
      setError(
        "Este EPUB não foi encontrado neste navegador nem na nuvem. Importe-o novamente em Minha biblioteca.",
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [localId, uid]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <h2 className="font-display text-3xl">Não foi possível abrir este livro</h2>
        <p className="mt-3 text-muted-foreground">{error}</p>
        <Link
          to="/biblioteca"
          className="mt-6 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Voltar à biblioteca
        </Link>
      </div>
    );
  }

  if (!book) {
    return (
      <ReaderPageSkeleton
        label={stage === "cloud" ? "Preparando sua cópia privada…" : "Abrindo seu livro…"}
      />
    );
  }

  return <ReaderPage uid={uid} book={book} />;
}

function PdfBookLoader({ uid, localId }: { uid: string; localId: string }) {
  const [book, setBook] = useState<PdfBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"local" | "cloud">("local");

  useEffect(() => {
    let cancelled = false;
    setBook(null);
    setError(null);
    setStage("local");

    async function load() {
      const local = await getPdfBook(localId).catch((err) => {
        console.warn("[reader] failed to read local pdf store", err);
        return null;
      });
      if (cancelled) return;
      if (local) {
        const upgraded = await ensurePdfBookText(local);
        if (cancelled) return;
        setBook(upgraded);
        if (upgraded !== local) {
          void savePdfBook(upgraded).catch(() => {});
          void uploadPdfBookToCloud(uid, upgraded).catch((error) =>
            console.warn("[pdf] background text-layer sync failed", error),
          );
        }
        return;
      }
      setStage("cloud");
      const cloudBook = await downloadPdfBookFromCloud(uid, localId);
      if (cancelled) return;
      if (cloudBook) {
        const upgraded = await ensurePdfBookText(cloudBook);
        if (cancelled) return;
        setBook(upgraded);
        void savePdfBook(upgraded).catch(() => {});
        if (upgraded !== cloudBook) {
          void uploadPdfBookToCloud(uid, upgraded).catch((error) =>
            console.warn("[pdf] background text-layer sync failed", error),
          );
        }
        return;
      }
      setError(
        "Este PDF não foi encontrado neste navegador nem na sua cópia privada. Importe-o novamente em Minha biblioteca.",
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [localId, uid]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <h2 className="font-display text-3xl">Não foi possível abrir este PDF</h2>
        <p className="mt-3 text-muted-foreground">{error}</p>
        <Link
          to="/biblioteca"
          className="mt-6 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Voltar à biblioteca
        </Link>
      </div>
    );
  }

  if (!book) {
    return (
      <ReaderPageSkeleton label={stage === "cloud" ? "Preparando seu PDF…" : "Abrindo PDF…"} />
    );
  }

  return <PdfReaderPage uid={uid} book={book} />;
}

function PdfReaderPage({ uid, book }: { uid: string; book: PdfBook }) {
  if (book.readerBook) {
    return <ReaderPage uid={uid} book={book.readerBook} />;
  }

  return <PdfOriginalViewer uid={uid} book={book} />;
}

function PdfOriginalViewer({ uid, book }: { uid: string; book: PdfBook }) {
  return <PdfPageViewer uid={uid} book={book} />;
}

function GutenbergBookLoader({ uid, gutenbergId }: { uid: string; gutenbergId: number }) {
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

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
  }, [gutenbergId, attempt]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <h2 className="font-display text-3xl">Não foi possível abrir este livro</h2>
        <p className="mt-3 text-muted-foreground">{error}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
          <Link
            to="/descobrir"
            search={{ q: undefined, categoria: undefined }}
            className="inline-block rounded-full border border-border/60 px-5 py-2.5 text-sm hover:border-gold/40 hover:text-gold"
          >
            Voltar a Descobrir
          </Link>
        </div>
      </div>
    );
  }

  if (!book) {
    return <ReaderPageSkeleton label="Baixando o livro…" />;
  }

  return <ReaderPage uid={uid} book={book} />;
}

const HIGHLIGHT_ACCENT: Record<HighlightColor, string> = {
  gold: "#C89B32",
  green: "#4A9B6E",
  blue: "#4A7FC4",
  pink: "#C46B9E",
};

const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  gold: "rgba(200,155,50,0.18)",
  green: "rgba(74,155,110,0.16)",
  blue: "rgba(74,127,196,0.16)",
  pink: "rgba(196,107,158,0.16)",
};

const THEME_STYLES = {
  light: {
    bg: "#FFFFFF",
    fg: "#1A1A1A",
    muted: "#6B6B6B",
    accent: "#8B5E34",
    rule: "rgba(0,0,0,0.1)",
  },
  paper: {
    bg: "#F2ECE1",
    fg: "#2A2420",
    muted: "#7A7062",
    accent: "#8B5E34",
    rule: "rgba(42,36,32,0.12)",
  },
  sepia: {
    bg: "#EFE0C0",
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
  amoled: {
    bg: "#000000",
    fg: "#F2F0EA",
    muted: "#A39C91",
    accent: "#D6B56F",
    rule: "rgba(242,240,234,0.14)",
  },
} as const;

const PAGE_GESTURE_HINT_KEY = "bookverse:reader-page-gesture-tip";
const PAGE_TURN_DURATION_MS = 640;
type PageTurnDirection = "next" | "previous";

type PageTurn = {
  direction: PageTurnDirection;
  pageIndex: number;
  snapshot: string;
};

type SelectedPassage = {
  text: string;
  context: string;
  startParagraphIndex: number;
  endParagraphIndex: number;
  startOffset: number;
  endOffset: number;
};

function ReaderPage({ uid, book }: { uid: string; book: Book }) {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [scrollRatio, setScrollRatio] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocTab, setTocTab] = useState<"toc" | "highlights" | "bookmarks">("toc");
  const [annotations, setAnnotations] = useState<BookAnnotations>({
    highlights: [],
    bookmarks: [],
  });
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [saved, setSaved] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [selectedPassage, setSelectedPassage] = useState<SelectedPassage | null>(null);
  const [completedChapterIndexes, setCompletedChapterIndexes] = useState<number[]>([]);
  const [bookCompletionRecorded, setBookCompletionRecorded] = useState(false);
  const [chapterCompletionOpen, setChapterCompletionOpen] = useState(false);
  const [completingChapter, setCompletingChapter] = useState(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chapterStartedAtRef = useRef(Date.now());

  // Paginated mode: content is laid out in CSS columns exactly as wide as
  // the visible container, so each "column" is one full page — navigation
  // moves horizontally by exactly one measured page width at a time.
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [pageWidthPx, setPageWidthPx] = useState(0);
  const [showPageGestureHint, setShowPageGestureHint] = useState(false);
  const [pageTurn, setPageTurn] = useState<PageTurn | null>(null);
  const pendingRatioRef = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageTurnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPageTurningRef = useRef(false);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setControlsVisible(false), 3600);
  }, []);

  useEffect(() => {
    revealControls();
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [book.id, revealControls]);

  // Opening a book counts as "starting" it — track it in the library so it
  // shows up under "Minha biblioteca" / "Continue lendo" and can be resumed.
  useEffect(() => {
    void markAsReading(uid, { title: book.title, author: book.author, cover: book.cover }, book.id);
  }, [uid, book.id, book.title, book.author, book.cover]);

  useEffect(() => subscribeAnnotations(uid, book.id, setAnnotations), [uid, book.id]);

  // Hydrate settings + progress after mount (avoid SSR mismatch).
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    void loadSettingsRemote(uid, s).then((remote) => setSettings(remote));
    void loadProgressRemote(book.id).then((p) => {
      if (p) {
        setChapterIndex(Math.min(p.chapterIndex, book.chapters.length - 1));
        setCompletedChapterIndexes(
          [...new Set((p.completedChapterIndexes ?? []).filter((index) => index >= 0))].sort(
            (a, b) => a - b,
          ),
        );
        setBookCompletionRecorded(Boolean(p.bookCompletionRecorded));
        pendingRatioRef.current = p.scrollRatio;
        if (s.mode === "scroll") {
          requestAnimationFrame(() => {
            const el = contentRef.current;
            if (el) el.scrollTop = p.scrollRatio * (el.scrollHeight - el.clientHeight);
            pendingRatioRef.current = null;
          });
        }
        // Paginated mode: left for the page-measurement effect below to
        // consume once it knows how many pages this chapter actually has.
      }
      setHydrated(true);
    });
  }, [book.id, book.chapters.length, uid]);

  // Persist settings.
  useEffect(() => {
    if (!hydrated) return;
    saveSettings(settings);
    void saveSettingsRemote(uid, settings);
  }, [settings, hydrated, uid]);

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

  const makeProgress = useCallback(
    (
      nextChapterIndex: number,
      nextScrollRatio: number,
      page?: { index: number; count: number },
    ): ReadingProgress => ({
      chapterIndex: nextChapterIndex,
      scrollRatio: nextScrollRatio,
      overallRatio: Math.min(
        1,
        (nextChapterIndex + Math.max(0, Math.min(1, nextScrollRatio))) / book.chapters.length,
      ),
      chapterCount: book.chapters.length,
      ...(page ? { pageIndex: page.index, pageCount: page.count } : {}),
      completedChapterIndexes,
      bookCompletionRecorded,
      updatedAt: Date.now(),
    }),
    [book.chapters.length, bookCompletionRecorded, completedChapterIndexes],
  );

  const onScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const denom = el.scrollHeight - el.clientHeight;
    const r = denom > 0 ? el.scrollTop / denom : 0;
    setScrollRatio(r);
    queueSave(makeProgress(chapterIndex, r));
  }, [chapterIndex, makeProgress, queueSave]);

  const goto = useCallback(
    (i: number, edgeRatio: 0 | 1 = 0) => {
      const clamped = Math.max(0, Math.min(book.chapters.length - 1, i));
      setChapterIndex(clamped);
      chapterStartedAtRef.current = Date.now();
      setScrollRatio(edgeRatio);
      setChapterCompletionOpen(false);
      setActiveHighlightId(null);
      setSelectedPassage(null);
      setEditingNoteFor(null);
      if (settings.mode === "paginated") {
        // Consumed by the page-measurement effect below once it knows how
        // many pages the newly-loaded chapter actually has — edgeRatio 1
        // means "land on the last page" (flipping backward into a chapter
        // should feel like arriving at its end, not its start).
        pendingRatioRef.current = edgeRatio;
      } else {
        requestAnimationFrame(() => {
          const el = contentRef.current;
          if (el)
            el.scrollTo({
              top: edgeRatio * (el.scrollHeight - el.clientHeight),
              behavior: "instant" as ScrollBehavior,
            });
        });
      }
      queueSave(makeProgress(clamped, edgeRatio));
      setTocOpen(false);
    },
    [book.chapters.length, makeProgress, queueSave, settings.mode],
  );

  /** A chapter is recorded only after the reader deliberately confirms it.
   * Chapter indices are persisted with progress, making reloads, back/next
   * navigation and a second device idempotent instead of XP-generating. */
  const completeCurrentChapter = useCallback(() => {
    if (completingChapter) return;
    const chapterAlreadyCompleted = completedChapterIndexes.includes(chapterIndex);
    const isLastChapter = chapterIndex === book.chapters.length - 1;
    const nextCompleted = chapterAlreadyCompleted
      ? completedChapterIndexes
      : [...completedChapterIndexes, chapterIndex].sort((a, b) => a - b);

    setCompletingChapter(true);
    setCompletedChapterIndexes(nextCompleted);
    const didRecordBook = bookCompletionRecorded || !isLastChapter;
    if (isLastChapter) setBookCompletionRecorded(true);

    const progress: ReadingProgress = {
      ...makeProgress(chapterIndex, scrollRatio, { index: pageIndex, count: pageCount }),
      completedChapterIndexes: nextCompleted,
      bookCompletionRecorded: isLastChapter ? true : bookCompletionRecorded,
      updatedAt: Date.now(),
    };
    // Completion is an important boundary: write now rather than waiting
    // for the normal debounce. `saveProgress` remains local-first offline.
    saveProgress(book.id, progress);

    if (!chapterAlreadyCompleted) {
      const minutes = Math.max(1, Math.round((Date.now() - chapterStartedAtRef.current) / 60_000));
      void recordGamificationMilestone("chapter-completed", `${book.id}:${chapterIndex}`, {
        chapterIndex,
        chapterCount: book.chapters.length,
        readingMinutes: minutes,
        pagesRead: Math.max(1, pageCount),
      });
    }
    if (isLastChapter) {
      void setLibraryStatus(uid, slugFor(book.title, book.author), "concluido").catch((err) =>
        console.warn("[reader] failed to mark book as completed in library", err),
      );
      if (!didRecordBook)
        void recordGamificationMilestone("book-completed", slugFor(book.title, book.author));
      toast.success("Livro concluído. Sua estante foi atualizada.");
    }

    setCompletingChapter(false);
    if (isLastChapter) {
      setChapterCompletionOpen(false);
      return;
    }
    goto(chapterIndex + 1, 0);
  }, [
    book.chapters.length,
    book.id,
    book.author,
    book.title,
    bookCompletionRecorded,
    chapterIndex,
    completedChapterIndexes,
    completingChapter,
    goto,
    makeProgress,
    pageCount,
    pageIndex,
    scrollRatio,
    uid,
  ]);

  // Track the container's visible width — each CSS column is set to
  // exactly this wide, so precisely one page shows in the viewport at a
  // time (rather than "roughly this size", which is what column-width
  // alone would give you, and could show 2+ pages side by side on a wide
  // screen).
  useEffect(() => {
    if (settings.mode !== "paginated") return;
    const el = contentRef.current;
    if (!el) return;
    const update = () => setPageWidthPx(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [settings.mode]);

  // Recompute how many pages the current chapter takes at this width/font/
  // spacing, and land on the right one — either a restored/edge position
  // from `goto`, or roughly where we already were if just the font size
  // (etc.) changed under our feet.
  useEffect(() => {
    if (settings.mode !== "paginated" || pageWidthPx <= 0) return;
    const el = contentRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      const rawPages = el.scrollWidth / pageWidthPx;
      const wholePages = Math.floor(rawPages);
      const remainder = rawPages - wholePages;
      // Browsers can report scrollWidth a few px past an exact multiple of
      // the measured page width (column-width is a hint, not an exact
      // contract), and naive rounding turns that sliver into a whole
      // extra, nearly-blank trailing page — especially visible on
      // image-heavy chapters (comics, illustrated books) where one page
      // is mostly a single picture. Only count the partial page if it
      // holds a meaningful chunk of content.
      const count = Math.max(1, remainder > 0.12 ? wholePages + 1 : Math.max(wholePages, 1));
      setPageCount(count);
      const pendingRatio = pendingRatioRef.current;
      const target =
        pendingRatio !== null
          ? Math.round(pendingRatio * (count - 1))
          : Math.min(pageIndex, count - 1);
      pendingRatioRef.current = null;
      el.scrollTo({ left: target * pageWidthPx, behavior: "instant" as ScrollBehavior });
      setPageIndex(target);
    });
    return () => cancelAnimationFrame(raf);
    // pageIndex is read but intentionally not a dependency — it would
    // fight the "stay near current position" logic above on every page turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.mode,
    pageWidthPx,
    chapterIndex,
    settings.fontSize,
    settings.lineHeight,
    settings.margin,
    settings.maxWidth,
    settings.font,
  ]);

  // Capture the page that is actually on screen before moving the column
  // underneath it. The temporary copy is then rotated as a paper leaf, so
  // the reader never sees a generic/empty transition layer.
  const startPageTurn = useCallback(
    (direction: PageTurnDirection) => {
      const article = articleRef.current;
      if (!settings.pageTurn || !article || pageWidthPx <= 0 || isPageTurningRef.current) {
        return false;
      }

      if (pageTurnTimer.current) clearTimeout(pageTurnTimer.current);
      isPageTurningRef.current = true;
      setPageTurn({ direction, pageIndex, snapshot: article.outerHTML });
      pageTurnTimer.current = setTimeout(() => {
        isPageTurningRef.current = false;
        setPageTurn(null);
      }, PAGE_TURN_DURATION_MS);
      return true;
    },
    [pageIndex, pageWidthPx, settings.pageTurn],
  );

  useEffect(
    () => () => {
      if (pageTurnTimer.current) clearTimeout(pageTurnTimer.current);
      isPageTurningRef.current = false;
    },
    [],
  );

  const goToPage = useCallback(
    (targetPage: number) => {
      if (isPageTurningRef.current) return;
      if (targetPage < 0) {
        goto(chapterIndex - 1, 1);
        return;
      }
      if (targetPage >= pageCount) {
        setChapterCompletionOpen(true);
        return;
      }
      const el = contentRef.current;
      if (!el || pageWidthPx <= 0) return;
      const turningOneLeaf =
        Math.abs(targetPage - pageIndex) === 1 &&
        startPageTurn(targetPage > pageIndex ? "next" : "previous");
      isProgrammaticScroll.current = true;
      const revealDestination = () => {
        // Paint the captured leaf first; moving the real column on the
        // following frame prevents a white flash on slower computers.
        el.scrollTo({
          left: targetPage * pageWidthPx,
          behavior: (turningOneLeaf ? "instant" : "smooth") as ScrollBehavior,
        });
        setPageIndex(targetPage);
        const r = pageCount > 1 ? targetPage / (pageCount - 1) : 0;
        setScrollRatio(r);
        queueSave(makeProgress(chapterIndex, r, { index: targetPage, count: pageCount }));
        setTimeout(
          () => {
            isProgrammaticScroll.current = false;
          },
          turningOneLeaf ? PAGE_TURN_DURATION_MS : 500,
        );
      };

      if (turningOneLeaf) requestAnimationFrame(revealDestination);
      else revealDestination();
    },
    [chapterIndex, pageCount, pageWidthPx, pageIndex, goto, makeProgress, queueSave, startPageTurn],
  );

  const dismissPageGestureHint = useCallback(() => {
    setShowPageGestureHint(false);
    try {
      localStorage.setItem(PAGE_GESTURE_HINT_KEY, "seen");
    } catch {
      // Private browsing can disable storage. The hint is still harmless.
    }
  }, []);

  // Page turns are deliberate rather than a raw horizontal scrollbar: a
  // lateral gesture advances exactly one virtual page, with the same paper
  // leaf animation used by the keyboard and the edge controls.
  const handlePaginatedTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("[data-reader-action='true']")) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, []);

  const handlePaginatedTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.target instanceof Element && event.target.closest("[data-reader-action='true']")) {
        touchStartRef.current = null;
        return;
      }
      const start = touchStartRef.current;
      touchStartRef.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch) return;

      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      // Ignore taps, text-selection gestures, and mostly vertical motions.
      if (Math.abs(dx) < 44 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;

      dismissPageGestureHint();
      revealControls();
      // Preserve the original BookVerse gesture: dragging the leaf to the
      // right advances; dragging it back to the left returns one page.
      goToPage(pageIndex + (dx > 0 ? 1 : -1));
    },
    [dismissPageGestureHint, goToPage, pageIndex, revealControls],
  );

  useEffect(() => {
    if (!hydrated || settings.mode !== "paginated") return;
    try {
      if (localStorage.getItem(PAGE_GESTURE_HINT_KEY) !== "seen") {
        setShowPageGestureHint(true);
      }
    } catch {
      setShowPageGestureHint(true);
    }
  }, [hydrated, settings.mode]);

  // Native swipe/drag is left free (no CSS scroll-snap — it can't target
  // individual CSS-column boundaries), then snapped to the nearest page
  // once the gesture settles. Skipped while a `goToPage` call is already
  // animating its own scroll, so the two don't fight each other.
  const onPaginatedScroll = useCallback(() => {
    if (isProgrammaticScroll.current) return;
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      const el = contentRef.current;
      if (!el || pageWidthPx <= 0) return;
      const nearest = Math.max(0, Math.min(pageCount - 1, Math.round(el.scrollLeft / pageWidthPx)));
      if (Math.abs(el.scrollLeft - nearest * pageWidthPx) > 2) {
        el.scrollTo({ left: nearest * pageWidthPx, behavior: "smooth" });
      }
      setPageIndex(nearest);
      const r = pageCount > 1 ? nearest / (pageCount - 1) : 0;
      setScrollRatio(r);
      queueSave(makeProgress(chapterIndex, r, { index: nearest, count: pageCount }));
    }, 120);
  }, [pageWidthPx, pageCount, chapterIndex, makeProgress, queueSave]);

  // Keyboard page-turning on desktop — ignored while typing in a note or
  // any other input so arrow keys still work normally there.
  useEffect(() => {
    if (settings.mode !== "paginated") return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "ArrowRight") goToPage(pageIndex + 1);
      else if (e.key === "ArrowLeft") goToPage(pageIndex - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settings.mode, pageIndex, goToPage]);

  const theme = THEME_STYLES[settings.theme];
  const chapter = book.chapters[chapterIndex];

  const overallProgress = useMemo(() => {
    const per = 1 / book.chapters.length;
    return Math.min(1, chapterIndex * per + scrollRatio * per);
  }, [book.chapters.length, chapterIndex, scrollRatio]);

  const chapterHighlights = useMemo(
    () => annotations.highlights.filter((highlight) => highlight.chapterId === chapter.id),
    [annotations.highlights, chapter.id],
  );
  const activeHighlight = useMemo(
    () => chapterHighlights.find((highlight) => highlight.id === activeHighlightId) ?? null,
    [activeHighlightId, chapterHighlights],
  );

  const captureTextSelection = useCallback(
    (event?: React.PointerEvent) => {
      const selection = window.getSelection();
      if (
        event?.target instanceof Element &&
        event.target.closest("[data-reader-action='true']") &&
        (!selection || selection.isCollapsed)
      ) {
        return;
      }
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return;
      }
      const range = selection.getRangeAt(0);
      const content = contentRef.current;
      if (!content || !content.contains(range.commonAncestorContainer)) {
        return;
      }
      const paragraphFor = (node: Node) => {
        const element =
          node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
        return element?.closest<HTMLElement>("[data-paragraph-index]") ?? null;
      };
      const startParagraph = paragraphFor(range.startContainer);
      const endParagraph = paragraphFor(range.endContainer);
      if (!startParagraph || !endParagraph) return;

      const startIndex = Number(startParagraph.dataset.paragraphIndex);
      const endIndex = Number(endParagraph.dataset.paragraphIndex);
      if (
        !Number.isFinite(startIndex) ||
        !Number.isFinite(endIndex) ||
        startIndex < 0 ||
        endIndex < startIndex
      ) {
        return;
      }

      const offsetIn = (paragraph: HTMLElement, node: Node, offset: number) => {
        const before = document.createRange();
        try {
          before.selectNodeContents(paragraph);
          before.setEnd(node, offset);
          return Math.max(
            0,
            Math.min(paragraph.textContent?.length ?? 0, before.toString().length),
          );
        } catch {
          return 0;
        }
      };
      const text = selection.toString().replace(/\s+/g, " ").trim();
      if (text.length < 2) return;

      const startOffset = offsetIn(startParagraph, range.startContainer, range.startOffset);
      const endOffset = offsetIn(endParagraph, range.endContainer, range.endOffset);
      if (startIndex === endIndex && endOffset <= startOffset) return;
      const context = chapter.paragraphs
        .slice(Math.max(0, startIndex - 1), Math.min(chapter.paragraphs.length, endIndex + 2))
        .join(" ")
        .slice(0, 1500);
      setActiveHighlightId(null);
      setSelectedPassage({
        text: text.slice(0, 1800),
        context,
        startParagraphIndex: startIndex,
        endParagraphIndex: endIndex,
        startOffset,
        endOffset,
      });
    },
    [chapter.paragraphs],
  );

  function askLumiAboutPassage(action: string, passage = selectedPassage) {
    if (!passage) return;
    openLumiPanel({
      bookTitle: book.title,
      bookAuthor: book.author,
      chapterTitle: chapter.title,
      chapterExcerpt: passage.context,
      selectedText: passage.text,
      positionLabel: `Capítulo ${chapterIndex + 1} de ${book.chapters.length}`,
      initialPrompt: `${action} o trecho selecionado, considerando o contexto da leitura.`,
    });
    window.getSelection()?.removeAllRanges();
    setSelectedPassage(null);
  }

  async function handleHighlightColor(color: HighlightColor) {
    try {
      if (activeHighlight) {
        if (activeHighlight.color === color) {
          await removeHighlight(uid, book.id, activeHighlight.id);
          setActiveHighlightId(null);
        } else {
          await updateHighlightColor(uid, book.id, activeHighlight.id, color);
        }
        return;
      }
      if (!selectedPassage) return;
      let created = 0;
      for (
        let paragraphIndex = selectedPassage.startParagraphIndex;
        paragraphIndex <= selectedPassage.endParagraphIndex;
        paragraphIndex += 1
      ) {
        const paragraph = chapter.paragraphs[paragraphIndex] ?? "";
        const startOffset =
          paragraphIndex === selectedPassage.startParagraphIndex ? selectedPassage.startOffset : 0;
        const endOffset =
          paragraphIndex === selectedPassage.endParagraphIndex
            ? selectedPassage.endOffset
            : paragraph.length;
        if (endOffset <= startOffset) continue;
        await addHighlight(uid, book.id, {
          chapterId: chapter.id,
          chapterIndex,
          paragraphIndex,
          startOffset,
          endOffset,
          color,
          excerpt: paragraph.slice(startOffset, Math.min(endOffset, startOffset + 140)),
        });
        created += 1;
      }
      window.getSelection()?.removeAllRanges();
      setSelectedPassage(null);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar o destaque agora."));
    }
  }

  async function handleShareHighlight(highlight: Highlight) {
    const paragraph = chapter.paragraphs[highlight.paragraphIndex] ?? "";
    const start = Math.max(0, highlight.startOffset ?? 0);
    const end = Math.min(paragraph.length, highlight.endOffset ?? paragraph.length);
    const quote = paragraph.slice(start, end).trim();
    if (!quote) return;
    const text = `"${quote}"\n— ${book.title}${book.author ? `, ${book.author}` : ""}\n\nLido no BookVerse 🦉`;
    try {
      if (navigator.share) {
        await navigator.share({ text, title: book.title });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Trecho copiado — cole onde quiser compartilhar.");
    } catch (err) {
      // AbortError just means the person closed the native share sheet —
      // not an actual failure, so it shouldn't show an error toast.
      if (err instanceof Error && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Trecho copiado — cole onde quiser compartilhar.");
      } catch {
        toast.error("Não foi possível compartilhar esse trecho agora.");
      }
    }
  }

  async function handleSaveNote(highlightId: string) {
    try {
      await updateHighlightNote(uid, book.id, highlightId, noteDraft.trim());
      setEditingNoteFor(null);
      setNoteDraft("");
      toast.success("Anotação salva.");
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar a anotação agora."));
    }
  }

  async function handleAddBookmark() {
    try {
      await addBookmark(uid, book.id, {
        chapterId: chapter.id,
        chapterIndex,
        scrollRatio,
        label: chapter.title,
      });
      toast.success("Página marcada.");
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar o marcador agora."));
    }
  }

  async function handleRemoveBookmark(bookmarkId: string) {
    try {
      await removeBookmark(uid, book.id, bookmarkId);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível remover o marcador agora."));
    }
  }

  function jumpToBookmark(b: { chapterIndex: number; scrollRatio: number }) {
    setChapterIndex(b.chapterIndex);
    setScrollRatio(b.scrollRatio);
    setTocOpen(false);
    requestAnimationFrame(() => {
      const el = contentRef.current;
      if (el) el.scrollTo({ top: b.scrollRatio * (el.scrollHeight - el.clientHeight) });
    });
  }

  function jumpToHighlight(h: { chapterIndex: number }) {
    goto(h.chapterIndex);
    setTocOpen(false);
  }

  const readerFontFamily = settings.font === "serif" ? "var(--font-display)" : "var(--font-sans)";

  const contentStyle: React.CSSProperties =
    settings.mode === "paginated"
      ? {
          columnWidth: pageWidthPx > 0 ? `${pageWidthPx}px` : "100%",
          columnGap: "0px",
          columnFill: "auto",
          height: "100%",
          overflowY: "hidden",
          overflowX: "auto",
          scrollbarWidth: "none",
          touchAction: "pan-y",
          padding: "5rem 0 4rem",
          boxSizing: "border-box",
        }
      : {
          overflowY: "auto",
          padding: `5rem ${settings.margin}px 5rem`,
        };

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col transition-colors duration-300"
      style={{ backgroundColor: theme.bg, color: theme.fg }}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onPointerUp={captureTextSelection}
    >
      {/* Top bar */}
      <header
        className={`absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 transition-all duration-300 md:px-6 ${
          controlsVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-full opacity-0"
        }`}
        style={{ borderColor: theme.rule, backgroundColor: theme.bg + "F2" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:opacity-70"
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
          <IconBtn theme={theme} onClick={handleAddBookmark} label="Marcar esta página">
            <BookmarkIcon className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            theme={theme}
            onClick={() =>
              openLumiPanel({
                bookTitle: book.title,
                bookAuthor: book.author,
                chapterTitle: chapter.title,
                chapterExcerpt: chapter.paragraphs.slice(0, 6).join(" ").slice(0, 1500),
                positionLabel: `Capítulo ${chapterIndex + 1} de ${book.chapters.length}`,
                initialPrompt:
                  "Traduza o trecho de referência para português do Brasil, preservando sentido, parágrafos e nomes próprios. Se ele já estiver em português, apenas informe isso.",
              })
            }
            label="Traduzir trecho do capítulo com a Lumi"
          >
            <Languages className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            theme={theme}
            onClick={() =>
              openLumiPanel({
                bookTitle: book.title,
                bookAuthor: book.author,
                chapterTitle: chapter.title,
                chapterExcerpt: chapter.paragraphs.slice(0, 3).join(" "),
                positionLabel: `Capítulo ${chapterIndex + 1} de ${book.chapters.length}`,
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
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={contentRef}
          onScroll={
            settings.mode === "scroll"
              ? onScroll
              : settings.mode === "paginated"
                ? onPaginatedScroll
                : undefined
          }
          onTouchStart={settings.mode === "paginated" ? handlePaginatedTouchStart : undefined}
          onTouchEnd={settings.mode === "paginated" ? handlePaginatedTouchEnd : undefined}
          style={contentStyle}
          className="h-full"
        >
          <article
            ref={articleRef}
            className="mx-auto"
            style={{
              maxWidth: `${settings.maxWidth}ch`,
              paddingInline: settings.mode === "paginated" ? `${settings.margin}px` : undefined,
              fontFamily: readerFontFamily,
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              color: theme.fg,
            }}
          >
            <header className="mb-10" style={{ breakInside: "avoid" }}>
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

            {(
              chapter.blocks ??
              chapter.paragraphs.map((_, i) => ({ type: "text" as const, paragraphIndex: i }))
            ).map((block, blockKey) => {
              if (block.type === "image") {
                return (
                  <figure
                    key={`img-${blockKey}`}
                    className="my-8 flex flex-col items-center"
                    style={{ breakInside: "avoid" }}
                  >
                    <img
                      src={block.src}
                      alt={block.alt ?? ""}
                      loading="lazy"
                      className="max-h-[calc(100vh-13rem)] w-auto max-w-full rounded-lg object-contain [box-shadow:0_8px_30px_rgba(0,0,0,0.25)]"
                    />
                  </figure>
                );
              }
              const i = block.paragraphIndex;
              const p = chapter.paragraphs[i];
              const paragraphHighlights = chapterHighlights.filter(
                (highlight) => highlight.paragraphIndex === i,
              );
              const editingHighlight =
                paragraphHighlights.find((highlight) => highlight.id === editingNoteFor) ?? null;
              return (
                <div key={i} className="relative" style={{ breakInside: "avoid" }}>
                  <p
                    data-paragraph-index={i}
                    className="rounded-sm px-2 -mx-2 py-0.5 [hyphens:auto]"
                    style={{ marginBottom: 0, textAlign: settings.alignment }}
                  >
                    <HighlightedParagraph
                      text={p}
                      highlights={paragraphHighlights}
                      activeHighlightId={activeHighlightId}
                      onHighlightClick={(highlight) => {
                        window.getSelection()?.removeAllRanges();
                        setSelectedPassage(null);
                        setActiveHighlightId(highlight.id);
                      }}
                    />
                  </p>

                  {paragraphHighlights
                    .filter((highlight) => highlight.note && highlight.id !== editingNoteFor)
                    .map((highlight) => (
                      <button
                        key={highlight.id}
                        data-reader-action="true"
                        onClick={() => {
                          setActiveHighlightId(highlight.id);
                          setEditingNoteFor(highlight.id);
                          setNoteDraft(highlight.note ?? "");
                        }}
                        className="mb-4 mt-1 flex items-start gap-2 rounded-lg border-l-2 py-1 pl-3 pr-2 text-left text-sm italic"
                        style={{ borderColor: theme.accent, color: theme.muted }}
                      >
                        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {highlight.note}
                      </button>
                    ))}
                  <div style={{ height: String(settings.paragraphSpacing) + "em" }} />

                  {editingHighlight && (
                    <div
                      data-reader-action="true"
                      className="mb-6 -mt-1 rounded-lg border p-3"
                      style={{ borderColor: theme.rule }}
                    >
                      <textarea
                        autoFocus
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Escreva uma anotação sobre este trecho..."
                        rows={3}
                        className="w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none"
                        style={{
                          borderColor: theme.rule,
                          color: theme.fg,
                          fontFamily: "var(--font-sans)",
                        }}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingNoteFor(null);
                            setNoteDraft("");
                          }}
                          className="rounded-full px-3 py-1.5 text-xs hover:opacity-70"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => void handleSaveNote(editingHighlight.id)}
                          className="rounded-full px-3 py-1.5 text-xs font-medium"
                          style={{ backgroundColor: theme.accent, color: theme.bg }}
                        >
                          Salvar nota
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

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
                onClick={() => setChapterCompletionOpen(true)}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-30"
                style={{ backgroundColor: theme.accent, color: theme.bg }}
              >
                {chapterIndex === book.chapters.length - 1
                  ? "Concluir livro"
                  : "Concluir e avançar"}{" "}
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </article>
        </div>

        {settings.mode === "paginated" && settings.pageTurn !== false && pageTurn && (
          <div
            aria-hidden="true"
            className={`reader-page-turn reader-page-turn--${pageTurn.direction}`}
          >
            <div
              className="reader-page-turn__sheet"
              style={{ backgroundColor: theme.bg, color: theme.fg }}
            >
              <div
                className="reader-page-turn__content"
                style={{
                  width: `${pageWidthPx}px`,
                  height: "100%",
                  columnWidth: `${pageWidthPx}px`,
                  columnGap: "0px",
                  columnFill: "auto",
                  padding: "5rem 0 4rem",
                  boxSizing: "border-box",
                  transform: `translateX(${-pageTurn.pageIndex * pageWidthPx}px)`,
                }}
                // This is a snapshot of our already-rendered article, never
                // raw EPUB markup. It keeps the exact text, images and theme
                // visible while the virtual sheet turns.
                dangerouslySetInnerHTML={{ __html: pageTurn.snapshot }}
              />
            </div>
          </div>
        )}

        {settings.mode === "paginated" && (
          <>
            <button
              onClick={() => goToPage(pageIndex - 1)}
              disabled={pageIndex === 0 && chapterIndex === 0}
              aria-label="Página anterior"
              className="absolute inset-y-0 left-0 w-[15%] min-w-10 cursor-pointer disabled:cursor-default"
            />
            <button
              onClick={() => goToPage(pageIndex + 1)}
              disabled={pageIndex === pageCount - 1 && chapterIndex === book.chapters.length - 1}
              aria-label="Próxima página"
              className="absolute inset-y-0 right-0 w-[15%] min-w-10 cursor-pointer disabled:cursor-default"
            />
          </>
        )}

        {settings.mode === "paginated" && showPageGestureHint && (
          <button
            type="button"
            onClick={dismissPageGestureHint}
            className="fixed bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4.75rem))] left-1/2 z-[60] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full border px-4 py-2 text-center text-xs shadow-lg backdrop-blur-md transition hover:opacity-80"
            style={{
              borderColor: theme.rule,
              color: theme.fg,
              backgroundColor: theme.bg + "EB",
              fontFamily: "var(--font-sans)",
            }}
          >
            Deslize à direita para avançar a página
          </button>
        )}

        {chapterCompletionOpen && (
          <div
            data-reader-action="true"
            className="fixed bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4.75rem))] left-1/2 z-[65] max-h-[calc(100dvh-6rem)] w-[min(92vw,27rem)] -translate-x-1/2 overflow-y-auto rounded-2xl border p-4 shadow-xl backdrop-blur-xl"
            style={{
              borderColor: theme.rule,
              backgroundColor: theme.bg + "FA",
              fontFamily: "var(--font-sans)",
            }}
          >
            <p className="text-sm font-semibold" style={{ color: theme.fg }}>
              {chapterIndex === book.chapters.length - 1
                ? "Você chegou ao final do livro."
                : "Fim do capítulo."}
            </p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: theme.muted }}>
              Confirme a conclusão para registrar este capítulo uma única vez e atualizar seu
              progresso.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                data-reader-action="true"
                onClick={() => setChapterCompletionOpen(false)}
                disabled={completingChapter}
                className="rounded-full px-3 py-1.5 text-xs"
                style={{ color: theme.muted }}
              >
                Ainda não
              </button>
              <button
                data-reader-action="true"
                onClick={completeCurrentChapter}
                disabled={completingChapter}
                className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                style={{ backgroundColor: theme.accent, color: theme.bg }}
              >
                {completingChapter
                  ? "Registrando…"
                  : chapterIndex === book.chapters.length - 1
                    ? "Concluir livro"
                    : "Concluir capítulo"}
              </button>
            </div>
          </div>
        )}

        {(selectedPassage || activeHighlight) && (
          <div
            data-reader-action="true"
            className="fixed inset-x-3 bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-[70] mx-auto grid max-h-[calc(100dvh-6rem)] w-auto max-w-[46rem] grid-cols-[auto_repeat(4,1.75rem)_auto] items-center justify-center gap-1.5 overflow-y-auto overscroll-contain rounded-2xl border p-2 shadow-xl backdrop-blur-xl sm:inset-x-auto sm:left-1/2 sm:flex sm:w-[min(94vw,46rem)] sm:-translate-x-1/2 sm:flex-wrap"
            style={{
              borderColor: theme.rule,
              backgroundColor: theme.bg + "F5",
              fontFamily: "var(--font-sans)",
            }}
          >
            <Highlighter className="ml-1 h-3.5 w-3.5" style={{ color: theme.muted }} />
            {(["gold", "green", "blue", "pink"] as HighlightColor[]).map((color) => (
              <button
                key={color}
                data-reader-action="true"
                onClick={() => void handleHighlightColor(color)}
                aria-label={`Destacar em ${color}`}
                className="h-7 w-7 rounded-full ring-1 ring-black/10 transition hover:scale-110"
                style={{
                  backgroundColor: HIGHLIGHT_ACCENT[color],
                  outline: activeHighlight?.color === color ? `2px solid ${theme.fg}` : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
            <span className="mx-0.5 h-5 w-px" style={{ backgroundColor: theme.rule }} />
            {activeHighlight ? (
              <>
                <button
                  data-reader-action="true"
                  onClick={() => {
                    setEditingNoteFor(activeHighlight.id);
                    setNoteDraft(activeHighlight.note ?? "");
                  }}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium transition hover:opacity-70"
                >
                  <StickyNote className="h-3.5 w-3.5" /> Nota
                </button>
                <button
                  data-reader-action="true"
                  onClick={() => void handleShareHighlight(activeHighlight)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium transition hover:opacity-70"
                >
                  <Share2 className="h-3.5 w-3.5" /> Compartilhar
                </button>
                <button
                  data-reader-action="true"
                  onClick={() => {
                    void removeHighlight(uid, book.id, activeHighlight.id);
                    setActiveHighlightId(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium transition hover:opacity-70"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </button>
              </>
            ) : (
              <>
                <span className="hidden text-xs sm:inline" style={{ color: theme.muted }}>
                  Toque numa cor para destacar
                </span>
                <button
                  data-reader-action="true"
                  onClick={() => askLumiAboutPassage("Explique em linguagem simples")}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium transition hover:opacity-70"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Explicar
                </button>
                <button
                  data-reader-action="true"
                  onClick={() => askLumiAboutPassage("Traduza para português do Brasil")}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium transition hover:opacity-70"
                >
                  <Languages className="h-3.5 w-3.5" /> Traduzir
                </button>
                <button
                  data-reader-action="true"
                  onClick={() =>
                    askLumiAboutPassage("Diga quem é a pessoa ou personagem mencionado")
                  }
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium transition hover:opacity-70"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Quem é?
                </button>
                <button
                  data-reader-action="true"
                  onClick={() => askLumiAboutPassage("Crie três flashcards curtos para revisar")}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium transition hover:opacity-70"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Flashcards
                </button>
              </>
            )}
            <button
              aria-label="Fechar ações do trecho"
              onClick={() => {
                window.getSelection()?.removeAllRanges();
                setSelectedPassage(null);
                setActiveHighlightId(null);
              }}
              className="rounded-full p-1.5"
              style={{ color: theme.muted }}
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Progress rail */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 border-t px-4 py-2.5 transition-all duration-300 md:px-6 ${
          controlsVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        }`}
        style={{
          borderColor: theme.rule,
          fontFamily: "var(--font-sans)",
          backgroundColor: theme.bg + "F2",
        }}
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
            {settings.mode === "paginated"
              ? `Pág. ${pageIndex + 1}/${pageCount} · Cap. ${chapterIndex + 1}/${book.chapters.length}`
              : `Cap. ${chapterIndex + 1}/${book.chapters.length}`}
          </span>
        </div>
      </div>

      {/* Settings panel */}
      <ReaderSettingsPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        settings={settings}
        onChange={(patch) => setSettings((s) => ({ ...s, ...patch, updatedAt: Date.now() }))}
        theme={theme}
      />

      {/* Table of contents / highlights / bookmarks */}
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
              <h3 className="font-display text-lg font-medium">{book.title}</h3>
              <div
                className="mt-3 grid grid-cols-3 gap-1 rounded-full p-1"
                style={{ backgroundColor: theme.rule, fontFamily: "var(--font-sans)" }}
              >
                {(
                  [
                    { key: "toc", label: "Sumário" },
                    { key: "highlights", label: "Destaques" },
                    { key: "bookmarks", label: "Marcadores" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTocTab(t.key)}
                    className="rounded-full px-2 py-1.5 text-xs font-medium transition"
                    style={{
                      backgroundColor: tocTab === t.key ? theme.accent : "transparent",
                      color: tocTab === t.key ? theme.bg : theme.fg,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {tocTab === "toc" && (
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
            )}

            {tocTab === "highlights" &&
              (annotations.highlights.length === 0 ? (
                <div className="flex-1 p-6 text-center text-sm" style={{ color: theme.muted }}>
                  <Highlighter className="mx-auto h-5 w-5" />
                  <p className="mt-3">Selecione um trecho durante a leitura para destacá-lo.</p>
                </div>
              ) : (
                <ul className="flex-1 space-y-2 overflow-y-auto p-3">
                  {[...annotations.highlights]
                    .sort(
                      (a, b) =>
                        a.chapterIndex - b.chapterIndex || a.paragraphIndex - b.paragraphIndex,
                    )
                    .map((h) => (
                      <li
                        key={h.id}
                        className="rounded-xl border p-3"
                        style={{ borderColor: theme.rule }}
                      >
                        <button
                          onClick={() => jumpToHighlight(h)}
                          className="block w-full text-left"
                        >
                          <p
                            className="text-sm"
                            style={{
                              boxShadow: `inset 3px 0 0 0 ${HIGHLIGHT_ACCENT[h.color]}`,
                              paddingLeft: 8,
                            }}
                          >
                            {h.excerpt}
                            {h.excerpt.length >= 140 ? "…" : ""}
                          </p>
                          {h.note && (
                            <p className="mt-2 text-xs italic" style={{ color: theme.muted }}>
                              {h.note}
                            </p>
                          )}
                        </button>
                        <button
                          onClick={() => void removeHighlight(uid, book.id, h.id)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px]"
                          style={{ color: theme.muted }}
                        >
                          <Trash2 className="h-3 w-3" /> Remover
                        </button>
                      </li>
                    ))}
                </ul>
              ))}

            {tocTab === "bookmarks" &&
              (annotations.bookmarks.length === 0 ? (
                <div className="flex-1 p-6 text-center text-sm" style={{ color: theme.muted }}>
                  <BookmarkIcon className="mx-auto h-5 w-5" />
                  <p className="mt-3">
                    Use o ícone de marcador no topo para salvar a página atual.
                  </p>
                </div>
              ) : (
                <ul className="flex-1 space-y-2 overflow-y-auto p-3">
                  {[...annotations.bookmarks]
                    .sort((a, b) => a.chapterIndex - b.chapterIndex)
                    .map((b) => (
                      <li key={b.id} className="flex items-center gap-2">
                        <button
                          onClick={() => jumpToBookmark(b)}
                          className="flex-1 rounded-xl border px-4 py-3 text-left"
                          style={{ borderColor: theme.rule }}
                        >
                          <span className="text-[10px] tabular-nums" style={{ color: theme.muted }}>
                            Cap. {b.chapterIndex + 1}
                          </span>
                          <span className="ml-3 font-display">{b.label}</span>
                        </button>
                        <button
                          onClick={() => void handleRemoveBookmark(b.id)}
                          aria-label="Remover marcador"
                          className="rounded-full p-2 hover:opacity-70"
                          style={{ color: theme.muted }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                </ul>
              ))}
          </aside>
        </>
      )}
    </div>
  );
}

function HighlightedParagraph({
  text,
  highlights,
  activeHighlightId,
  onHighlightClick,
}: {
  text: string;
  highlights: Highlight[];
  activeHighlightId: string | null;
  onHighlightClick: (highlight: Highlight) => void;
}) {
  const ranges = highlights
    .map((highlight) => ({
      highlight,
      start: Math.max(0, Math.min(text.length, highlight.startOffset ?? 0)),
      end: Math.max(0, Math.min(text.length, highlight.endOffset ?? text.length)),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    // Do not nest marks when a legacy full-paragraph highlight overlaps a
    // newer selection. The newer range is still stored; rendering remains
    // readable until the legacy mark is removed.
    if (range.start < cursor) continue;
    if (range.start > cursor) {
      parts.push(text.slice(cursor, range.start));
    }
    const selected = range.highlight.id === activeHighlightId;
    parts.push(
      <mark
        key={range.highlight.id}
        data-reader-action="true"
        onClick={() => {
          if (window.getSelection()?.isCollapsed) onHighlightClick(range.highlight);
        }}
        className="cursor-pointer rounded-[0.18em] px-[0.04em] transition-shadow"
        style={{
          backgroundColor: HIGHLIGHT_BG[range.highlight.color],
          boxShadow: selected
            ? `inset 0 -2px 0 ${HIGHLIGHT_ACCENT[range.highlight.color]}, 0 0 0 1px ${HIGHLIGHT_ACCENT[range.highlight.color]}`
            : `inset 0 -2px 0 ${HIGHLIGHT_ACCENT[range.highlight.color]}`,
          color: "inherit",
        }}
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
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
      className="grid h-10 w-10 place-items-center rounded-full transition hover:opacity-70"
      style={{ color: theme.fg }}
    >
      {children}
    </button>
  );
}
