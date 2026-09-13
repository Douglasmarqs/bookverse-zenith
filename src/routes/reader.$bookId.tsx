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
  updateHighlightNote,
  addBookmark,
  removeBookmark,
  type BookAnnotations,
  type HighlightColor,
} from "@/lib/annotations";
import { ReaderSettingsPanel } from "@/components/reader/settings-panel";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { awardXp, incrementBooksCompleted, recordReadingActivity } from "@/lib/user-profile";
import { markAsReading, setLibraryStatus, slugFor } from "@/lib/library";
import { toast } from "sonner";
import { describeFirestoreError } from "@/lib/async-utils";
import { ReaderPageSkeleton } from "@/components/reader-page-skeleton";

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
    | { source: "epub"; localId: string } => {
    const sample = getSampleBook(params.bookId);
    if (sample) return { source: "sample", book: sample };
    const gutenbergId = parseGutenbergReaderId(params.bookId);
    if (gutenbergId !== null) return { source: "gutenberg", gutenbergId };
    if (isEpubReaderId(params.bookId)) return { source: "epub", localId: params.bookId };
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
const PAGE_TURN_DURATION_MS = 720;
type PageTurnDirection = "next" | "previous";

type PageTurn = {
  direction: PageTurnDirection;
  pageIndex: number;
  snapshot: string;
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
  const [activeParagraph, setActiveParagraph] = useState<number | null>(null);
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [saved, setSaved] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [selectedPassage, setSelectedPassage] = useState<{ text: string; context: string } | null>(
    null,
  );
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      updatedAt: Date.now(),
    }),
    [book.chapters.length],
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
      if (clamped > chapterIndex) {
        void awardXp(uid, 20);
        void recordReadingActivity(uid, { chapterCompleted: true });
        if (clamped === book.chapters.length - 1) {
          void incrementBooksCompleted(uid);
          void setLibraryStatus(uid, slugFor(book.title, book.author), "concluido").catch((err) =>
            console.warn("[reader] failed to mark book as completed in library", err),
          );
        }
      }
      setChapterIndex(clamped);
      setScrollRatio(edgeRatio);
      setActiveParagraph(null);
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
    [
      book.chapters.length,
      book.title,
      book.author,
      chapterIndex,
      makeProgress,
      queueSave,
      settings.mode,
      uid,
    ],
  );

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
        goto(chapterIndex + 1, 0);
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
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, []);

  const handlePaginatedTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
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
      goToPage(pageIndex + (dx < 0 ? 1 : -1));
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

  const currentHighlight = useCallback(
    (paragraphIndex: number) =>
      annotations.highlights.find(
        (h) => h.chapterId === chapter.id && h.paragraphIndex === paragraphIndex,
      ),
    [annotations.highlights, chapter.id],
  );

  const captureTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!text || text.length < 2 || !contentRef.current?.contains(selection?.anchorNode ?? null)) {
      setSelectedPassage(null);
      return;
    }
    const boundedText = text.slice(0, 900);
    const anchor =
      selection?.anchorNode?.parentElement?.closest<HTMLElement>("[data-paragraph-index]");
    const index = Number(anchor?.dataset.paragraphIndex ?? 0);
    const safeIndex = Number.isFinite(index)
      ? Math.max(0, Math.min(chapter.paragraphs.length - 1, index))
      : 0;
    const nearby = chapter.paragraphs
      .slice(Math.max(0, safeIndex - 1), Math.min(chapter.paragraphs.length, safeIndex + 2))
      .join(" ")
      .slice(0, 1500);
    setSelectedPassage({ text: boundedText, context: nearby });
  }, [chapter.paragraphs]);

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

  async function handleHighlight(paragraphIndex: number, color: HighlightColor) {
    const existing = currentHighlight(paragraphIndex);
    try {
      if (existing) {
        if (existing.color === color) {
          await removeHighlight(uid, book.id, existing.id);
        } else {
          await removeHighlight(uid, book.id, existing.id);
          await addHighlight(uid, book.id, {
            chapterId: chapter.id,
            chapterIndex,
            paragraphIndex,
            color,
            excerpt: chapter.paragraphs[paragraphIndex].slice(0, 140),
          });
        }
      } else {
        await addHighlight(uid, book.id, {
          chapterId: chapter.id,
          chapterIndex,
          paragraphIndex,
          color,
          excerpt: chapter.paragraphs[paragraphIndex].slice(0, 140),
        });
        void awardXp(uid, 2);
      }
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar o destaque agora."));
    }
  }

  async function handleShareHighlight(paragraphIndex: number) {
    const quote = chapter.paragraphs[paragraphIndex]?.trim();
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
              const highlight = currentHighlight(i);
              const isActive = activeParagraph === i;
              const isEditingNote = highlight && editingNoteFor === highlight.id;
              return (
                <div key={i} className="relative" style={{ breakInside: "avoid" }}>
                  <p
                    data-paragraph-index={i}
                    onClick={() => setActiveParagraph(isActive ? null : i)}
                    className="cursor-pointer rounded-sm px-2 -mx-2 py-0.5 [hyphens:auto] transition-colors"
                    style={
                      highlight
                        ? {
                            backgroundColor: HIGHLIGHT_BG[highlight.color],
                            boxShadow: `inset 3px 0 0 0 ${HIGHLIGHT_ACCENT[highlight.color]}`,
                            marginBottom: 0,
                            textAlign: settings.alignment,
                          }
                        : { marginBottom: 0, textAlign: settings.alignment }
                    }
                  >
                    {p}
                  </p>

                  {highlight?.note && !isEditingNote && (
                    <button
                      onClick={() => {
                        setEditingNoteFor(highlight.id);
                        setNoteDraft(highlight.note ?? "");
                      }}
                      className="mb-6 mt-1 flex items-start gap-2 rounded-lg border-l-2 py-1 pl-3 pr-2 text-left text-sm italic"
                      style={{ borderColor: theme.accent, color: theme.muted }}
                    >
                      <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {highlight.note}
                    </button>
                  )}
                  {!highlight?.note && <div style={{ height: `${settings.paragraphSpacing}em` }} />}

                  {isActive && (
                    <div
                      className="mb-4 -mt-1 flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-xs"
                      style={{ borderColor: theme.rule, fontFamily: "var(--font-sans)" }}
                    >
                      <Highlighter className="h-3.5 w-3.5" style={{ color: theme.muted }} />
                      {(["gold", "green", "blue", "pink"] as HighlightColor[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => void handleHighlight(i, c)}
                          aria-label={`Destacar em ${c}`}
                          className="h-6 w-6 rounded-full ring-1 ring-black/10 transition hover:scale-110"
                          style={{
                            backgroundColor: HIGHLIGHT_ACCENT[c],
                            outline: highlight?.color === c ? `2px solid ${theme.fg}` : "none",
                            outlineOffset: "2px",
                          }}
                        />
                      ))}
                      <span className="mx-1 h-4 w-px" style={{ backgroundColor: theme.rule }} />
                      {highlight ? (
                        <>
                          <button
                            onClick={() => {
                              setEditingNoteFor(highlight.id);
                              setNoteDraft(highlight.note ?? "");
                            }}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:opacity-70"
                          >
                            <StickyNote className="h-3.5 w-3.5" /> Nota
                          </button>
                          <button
                            onClick={() => void handleShareHighlight(i)}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:opacity-70"
                          >
                            <Share2 className="h-3.5 w-3.5" /> Compartilhar
                          </button>
                          <button
                            onClick={() => void handleHighlight(i, highlight.color)}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:opacity-70"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remover
                          </button>
                        </>
                      ) : (
                        <span style={{ color: theme.muted }}>Toque numa cor pra destacar</span>
                      )}
                      <button
                        onClick={() =>
                          askLumiAboutPassage("Explique em linguagem simples", {
                            text: p.slice(0, 900),
                            context: chapter.paragraphs
                              .slice(Math.max(0, i - 1), Math.min(chapter.paragraphs.length, i + 2))
                              .join(" ")
                              .slice(0, 1500),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:opacity-70"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Explicar
                      </button>
                      <button
                        onClick={() => setActiveParagraph(null)}
                        className="ml-auto rounded-full p-1 hover:opacity-70"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {isEditingNote && (
                    <div
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
                          onClick={() => void handleSaveNote(highlight!.id)}
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
            className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border px-4 py-2 text-xs shadow-lg backdrop-blur-md transition hover:opacity-80"
            style={{
              borderColor: theme.rule,
              color: theme.fg,
              backgroundColor: theme.bg + "EB",
              fontFamily: "var(--font-sans)",
            }}
          >
            Deslize para os lados para virar a página
          </button>
        )}

        {selectedPassage && (
          <div
            className="absolute bottom-5 left-1/2 z-30 flex w-[min(94vw,42rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-2xl border p-2 shadow-xl backdrop-blur-xl"
            style={{
              borderColor: theme.rule,
              backgroundColor: theme.bg + "F5",
              fontFamily: "var(--font-sans)",
            }}
          >
            {[
              ["O que significa?", "Explique o significado de"],
              ["Explique", "Explique em linguagem simples"],
              ["Resumir", "Resuma"],
              ["Contexto", "Dê o contexto de"],
              ["Por que?", "Explique por que isso acontece em"],
            ].map(([label, action]) => (
              <button
                key={label}
                onClick={() => askLumiAboutPassage(action)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition hover:opacity-70"
                style={{ color: theme.fg, backgroundColor: theme.rule }}
              >
                {label}
              </button>
            ))}
            <button
              aria-label="Fechar ações do trecho"
              onClick={() => {
                window.getSelection()?.removeAllRanges();
                setSelectedPassage(null);
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
                  <p className="mt-3">Toque em um parágrafo durante a leitura para destacá-lo.</p>
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
