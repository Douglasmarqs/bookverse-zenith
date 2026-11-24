import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { rememberLastBook } from "@/lib/nav";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "firebase/auth";
import { ensureUser, subscribeAuth } from "@/lib/firebase";
import { AnimatePresence, motion } from "motion/react";
import "@fontsource-variable/literata/opsz.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import { READER_FONTS } from "@/components/reader/settings-panel";
import { useReadingTimer } from "@/lib/ritual";
import { setAmbient, stopAmbient } from "@/lib/ambient-sound";
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
  Search as SearchIcon,
  Keyboard,
  Clock,
  Headphones,
  NotebookPen,
  ALargeSmall,
  Copy,
  BookA,
} from "lucide-react";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";

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
import { resolveTurnStyle, type TurnStyle } from "@/lib/reader-store";
import { TURN_MS, TurnStage, tween, type TurnStageHandle } from "@/components/reader/page-turn";
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
import { ListenMode } from "@/components/reader/listen-mode";
import { PageOverview } from "@/components/reader/page-overview";
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

type ReaderSession =
  | { state: "loading" }
  | { state: "ready"; user: User; guest: boolean }
  | { state: "redirecting" }
  | { state: "unavailable" };

/**
 * Public-domain classics and the sample book open for everyone: a visitor
 * gets an anonymous session, so progress, highlights and bookmarks are saved
 * from the first page — and creating an account later links that same
 * session, keeping everything. Private EPUB/PDF files still need an account.
 */
function useReaderSession(allowGuest: boolean): ReaderSession {
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const originRef = useRef(href);
  const [session, setSession] = useState<ReaderSession>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    let triedGuest = false;
    const unsub = subscribeAuth((u) => {
      if (cancelled) return;
      if (u && (!u.isAnonymous || allowGuest)) {
        setSession({ state: "ready", user: u, guest: u.isAnonymous });
        return;
      }
      if (allowGuest) {
        if (triedGuest) return;
        triedGuest = true;
        void ensureUser().then((guest) => {
          if (!cancelled && !guest) setSession({ state: "unavailable" });
        });
        return;
      }
      setSession({ state: "redirecting" });
      navigate({
        to: "/auth",
        search: { redirect: originRef.current },
        replace: true,
        viewTransition: false,
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [allowGuest, navigate]);

  return session;
}

const ReaderGuestContext = createContext(false);

function GuardedReaderPage() {
  const loaderData = Route.useLoaderData();
  // Books saved on this device (free catalogue downloads) open for guests
  // too; only cloud copies of personal files need an account. PDFs are
  // always personal imports.
  const privateFile = loaderData.source === "pdf";
  const session = useReaderSession(!privateFile);

  if (session.state !== "ready") {
    return (
      <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-md place-items-center px-6 text-center">
        {session.state === "unavailable" ? (
          <div>
            <p className="font-display text-4xl">Não foi possível abrir o livro</p>
            <p className="mt-3 text-sm text-muted-foreground">
              A leitura como convidado não está disponível agora. Entre na sua conta para continuar.
            </p>
            <Link to="/auth" search={{ redirect: undefined }} className="btn-primary mt-6">
              Entrar
            </Link>
          </div>
        ) : (
          <div>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
            <p className="mt-4 text-sm text-muted-foreground">
              {session.state === "loading" ? "Abrindo o livro…" : "Redirecionando para o login…"}
            </p>
          </div>
        )}
      </div>
    );
  }

  const { user, guest } = session;
  let content: React.ReactNode;
  if (loaderData.source === "sample") {
    content = <ReaderPage uid={user.uid} book={loaderData.book} />;
  } else if (loaderData.source === "epub") {
    content = <EpubBookLoader uid={user.uid} localId={loaderData.localId} />;
  } else if (loaderData.source === "pdf") {
    content = <PdfBookLoader uid={user.uid} localId={loaderData.localId} />;
  } else {
    content = <GutenbergBookLoader uid={user.uid} gutenbergId={loaderData.gutenbergId} />;
  }
  return <ReaderGuestContext.Provider value={guest}>{content}</ReaderGuestContext.Provider>;
}

function EpubBookLoader({ uid, localId }: { uid: string; localId: string }) {
  const guest = useContext(ReaderGuestContext);
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
      if (guest) {
        setError(
          "Este livro não está salvo neste aparelho. Entre na sua conta para buscá-lo na nuvem, ou baixe-o de novo em Explorar.",
        );
        return;
      }
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
  }, [localId, uid, guest]);

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
  gold: "#FFE066",
  green: "#A7F3C5",
  blue: "#A9CBFF",
  pink: "#FFB4C8",
  lilac: "#D6C6FF",
};

const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  gold: "rgba(255,224,102,0.62)",
  green: "rgba(120,220,160,0.42)",
  blue: "rgba(130,175,255,0.40)",
  pink: "rgba(255,150,180,0.40)",
  lilac: "rgba(190,170,255,0.42)",
};

const THEME_STYLES = {
  light: {
    bg: "#FFFFFF",
    fg: "#1B1B1B",
    muted: "#8B8A85",
    accent: "#FF4D1A",
    rule: "rgba(0,0,0,0.09)",
  },
  paper: {
    bg: "#F7F3EA",
    fg: "#2A2620",
    muted: "#8F877A",
    accent: "#E5482B",
    rule: "rgba(42,38,32,0.11)",
  },
  sepia: {
    bg: "#F5ECD9",
    fg: "#3B2F22",
    muted: "#9A8A72",
    accent: "#C2451E",
    rule: "rgba(59,47,34,0.14)",
  },
  gray: {
    bg: "#3A3A3D",
    fg: "#E8E6E1",
    muted: "#A9A7A1",
    accent: "#FF8A5B",
    rule: "rgba(232,230,225,0.14)",
  },
  dark: {
    bg: "#111113",
    fg: "#D9D6CF",
    muted: "#6E6D68",
    accent: "#FF6436",
    rule: "rgba(217,214,207,0.12)",
  },
  amoled: {
    bg: "#000000",
    fg: "#E6E3DC",
    muted: "#6E6D68",
    accent: "#FF6436",
    rule: "rgba(230,227,220,0.14)",
  },
} as const;

const PAGE_GESTURE_HINT_KEY = "bookverse:reader-page-gesture-tip";
const PAGE_PADDING = "4.25rem 0 4rem";
const ACCENT = "#FF4D1A";

function romanize(n: number): string {
  const map: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [v, r] of map)
    while (n >= v) {
      out += r;
      n -= v;
    }
  return out;
}
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
  /** Where the selection sits on screen, to place the popover next to it. */
  rect?: { top: number; bottom: number; left: number; right: number };
};

function ReaderPage({ uid, book }: { uid: string; book: Book }) {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [scrollRatio, setScrollRatio] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocTab, setTocTab] = useState<"toc" | "highlights" | "bookmarks" | "search">("toc");
  const [searchQuery, setSearchQuery] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [scrubValue, setScrubValue] = useState<number | null>(null);
  const [annotations, setAnnotations] = useState<BookAnnotations>({
    highlights: [],
    bookmarks: [],
    pdfRegions: [],
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
  // Active reading time feeds the daily ritual on the home screen.
  useReadingTimer(uid);
  const chapterStartedAtRef = useRef(Date.now());

  // Paginated mode: content is laid out in CSS columns exactly as wide as
  // the visible container, so each "column" is one full page — navigation
  // moves horizontally by exactly one measured page width at a time.
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [pageWidthPx, setPageWidthPx] = useState(0);
  const [showPageGestureHint, setShowPageGestureHint] = useState(false);
  const [turn, setTurn] = useState<{
    from: number;
    to: number;
    style: Exclude<TurnStyle, "instantaneo">;
    snapshot: string;
  } | null>(null);
  const stageRef = useRef<TurnStageHandle>(null);
  const turnModeRef = useRef<"auto" | "drag">("auto");
  const dragRef = useRef<{
    x: number;
    y: number;
    t: number;
    active: boolean;
    dir: 1 | -1;
    p: number;
  } | null>(null);
  const cancelTweenRef = useRef<(() => void) | null>(null);
  const pagesTurnedRef = useRef(0);
  const [einkFlash, setEinkFlash] = useState(false);
  const [listenOpen, setListenOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const pendingRatioRef = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);
  const suppressPageNavigationUntilRef = useRef(0);

  const contentRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const guest = useContext(ReaderGuestContext);
  const [guestTipOpen, setGuestTipOpen] = useState(true);
  // Lets the dock's "Ler" button (and the landing) jump straight back in.
  useEffect(() => {
    rememberLastBook(book.id, book.title, book.author);
  }, [book.id, book.title, book.author]);

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

  /** Lands on any position: a chapter plus a 0–1 ratio inside it. Used by
   * bookmarks, highlights, search results and the location scrubber, in
   * both paginated and scroll modes (and within the current chapter). */
  const jumpTo = useCallback(
    (targetChapter: number, ratio: number) => {
      const clamped = Math.max(0, Math.min(book.chapters.length - 1, targetChapter));
      const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
      setTocOpen(false);
      setSelectedPassage(null);
      setActiveHighlightId(null);
      setChapterCompletionOpen(false);
      if (settings.mode === "paginated") {
        if (clamped === chapterIndex) {
          const el = contentRef.current;
          if (!el || pageWidthPx <= 0) return;
          const target = Math.round(r * Math.max(0, pageCount - 1));
          isProgrammaticScroll.current = true;
          el.scrollTo({ left: target * pageWidthPx, behavior: "instant" as ScrollBehavior });
          setPageIndex(target);
          const nr = pageCount > 1 ? target / (pageCount - 1) : 0;
          setScrollRatio(nr);
          queueSave(makeProgress(clamped, nr, { index: target, count: pageCount }));
          setTimeout(() => {
            isProgrammaticScroll.current = false;
          }, 200);
        } else {
          pendingRatioRef.current = r;
          chapterStartedAtRef.current = Date.now();
          setChapterIndex(clamped);
          setScrollRatio(r);
          queueSave(makeProgress(clamped, r));
        }
        return;
      }
      if (clamped !== chapterIndex) chapterStartedAtRef.current = Date.now();
      setChapterIndex(clamped);
      setScrollRatio(r);
      queueSave(makeProgress(clamped, r));
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const el = contentRef.current;
          if (el) el.scrollTo({ top: r * (el.scrollHeight - el.clientHeight) });
        }),
      );
    },
    [
      book.chapters.length,
      chapterIndex,
      makeProgress,
      pageCount,
      pageWidthPx,
      queueSave,
      settings.mode,
    ],
  );

  /** Reaching the end records the chapter once and advances immediately.
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

  const turnStyle = resolveTurnStyle(settings);

  // Lands the real column on `targetPage` (instantly — any animation has
  // already been played by the turn stage on top of it).
  const commitPage = useCallback(
    (targetPage: number) => {
      const el = contentRef.current;
      if (!el || pageWidthPx <= 0) return;
      isProgrammaticScroll.current = true;
      el.scrollTo({ left: targetPage * pageWidthPx, behavior: "instant" as ScrollBehavior });
      setPageIndex(targetPage);
      const r = pageCount > 1 ? targetPage / (pageCount - 1) : 0;
      setScrollRatio(r);
      queueSave(makeProgress(chapterIndex, r, { index: targetPage, count: pageCount }));
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 150);
      if (settings.einkRefresh) {
        pagesTurnedRef.current += 1;
        if (pagesTurnedRef.current % 6 === 0) {
          setEinkFlash(true);
          setTimeout(() => setEinkFlash(false), 140);
        }
      }
    },
    [chapterIndex, makeProgress, pageCount, pageWidthPx, queueSave, settings.einkRefresh],
  );

  const finishTurn = useCallback(
    (target: number | null) => {
      if (target !== null) commitPage(target);
      // One frame later, so the real column is already in place underneath.
      requestAnimationFrame(() => {
        setTurn(null);
        isPageTurningRef.current = false;
        dragRef.current = null;
      });
    },
    [commitPage],
  );

  /** Mounts the turn stage for a one-page move. False when not animating. */
  const beginTurn = useCallback(
    (target: number, mode: "auto" | "drag"): boolean => {
      const article = articleRef.current;
      if (turnStyle === "instantaneo" || !article || pageWidthPx <= 0 || isPageTurningRef.current) {
        return false;
      }
      isPageTurningRef.current = true;
      turnModeRef.current = mode;
      setTurn({ from: pageIndex, to: target, style: turnStyle, snapshot: article.outerHTML });
      return true;
    },
    [pageIndex, pageWidthPx, turnStyle],
  );

  // Plays an automatic turn (keys, taps, buttons) once the stage is mounted.
  useEffect(() => {
    if (!turn) return;
    if (turnModeRef.current === "drag") {
      stageRef.current?.set(dragRef.current?.p ?? 0);
      return;
    }
    cancelTweenRef.current = tween(
      0,
      1,
      TURN_MS[turn.style],
      (p) => stageRef.current?.set(p),
      () => finishTurn(turn.to),
    );
    return () => cancelTweenRef.current?.();
  }, [turn, finishTurn]);

  useEffect(
    () => () => {
      cancelTweenRef.current?.();
      isPageTurningRef.current = false;
    },
    [],
  );

  const goToPage = useCallback(
    (targetPage: number) => {
      const selection = window.getSelection();
      if (
        Date.now() < suppressPageNavigationUntilRef.current ||
        (selection && !selection.isCollapsed)
      ) {
        return;
      }
      if (isPageTurningRef.current) return;
      if (targetPage < 0) {
        goto(chapterIndex - 1, 1);
        return;
      }
      if (targetPage >= pageCount) {
        if (chapterIndex === book.chapters.length - 1) setChapterCompletionOpen(true);
        else completeCurrentChapter();
        return;
      }
      if (Math.abs(targetPage - pageIndex) === 1 && beginTurn(targetPage, "auto")) return;
      commitPage(targetPage);
    },
    [
      beginTurn,
      book.chapters.length,
      chapterIndex,
      commitPage,
      completeCurrentChapter,
      goto,
      pageCount,
      pageIndex,
    ],
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
      dragRef.current = null;
      return;
    }
    if (!window.getSelection()?.isCollapsed || isPageTurningRef.current) {
      suppressPageNavigationUntilRef.current = Date.now() + 700;
      dragRef.current = null;
      return;
    }
    const touch = event.touches[0];
    dragRef.current = touch
      ? { x: touch.clientX, y: touch.clientY, t: performance.now(), active: false, dir: 1, p: 0 }
      : null;
  }, []);

  // Folha / Deslizar follow the finger: the page moves with it and only
  // turns for real when you let go past a quarter (or flick).
  const handlePaginatedTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      const touch = event.touches[0];
      if (!d || !touch) return;
      const dx = touch.clientX - d.x;
      const dy = touch.clientY - d.y;
      if (!d.active) {
        if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
        if (selectedPassage || !window.getSelection()?.isCollapsed) return;
        const dir: 1 | -1 = dx < 0 ? 1 : -1;
        const target = pageIndex + dir;
        const followable = turnStyle === "folha" || turnStyle === "deslizar";
        if (!followable || target < 0 || target >= pageCount) return;
        d.dir = dir;
        d.active = beginTurn(target, "drag");
        if (!d.active) return;
      }
      const width = contentRef.current?.clientWidth ?? 360;
      d.p = Math.max(0, Math.min(1, (-dx * d.dir) / (width * 0.85)));
      stageRef.current?.set(d.p);
    },
    [beginTurn, pageCount, pageIndex, selectedPassage, turnStyle],
  );

  const handlePaginatedTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      const touch = event.changedTouches[0];
      if (!d || !touch) return;
      const dx = touch.clientX - d.x;
      const dy = touch.clientY - d.y;

      if (d.active && turn) {
        const elapsed = Math.max(1, performance.now() - d.t);
        const flick = Math.abs(dx) / elapsed > 0.5 && Math.sign(-dx) === d.dir;
        const complete = d.p > 0.25 || flick;
        const ms = TURN_MS[turn.style] * (complete ? 1 - d.p : d.p) + 120;
        const target = turn.to;
        suppressPageNavigationUntilRef.current = Date.now() + 450;
        cancelTweenRef.current = tween(
          d.p,
          complete ? 1 : 0,
          ms,
          (p) => stageRef.current?.set(p),
          () => finishTurn(complete ? target : null),
        );
        dismissPageGestureHint();
        return;
      }
      dragRef.current = null;

      const selection = window.getSelection();
      if (
        Date.now() < suppressPageNavigationUntilRef.current ||
        selectedPassage ||
        (selection && !selection.isCollapsed)
      ) {
        suppressPageNavigationUntilRef.current = Date.now() + 700;
        return;
      }
      // Ignore taps, text-selection gestures, and mostly vertical motions.
      if (Math.abs(dx) < 44 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
      dismissPageGestureHint();
      // Like a paper book (and a Kindle): swipe left for the next page.
      goToPage(pageIndex + (dx < 0 ? 1 : -1));
    },
    [dismissPageGestureHint, finishTurn, goToPage, pageIndex, selectedPassage, turn],
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

  // Keyboard: arrows/space/PageUp/PageDown turn pages (or scroll), and
  // single letters open the main tools — ignored while typing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = contentRef.current;
      const forward =
        e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey);
      const back = e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey);
      if (forward || back) {
        e.preventDefault();
        if (settings.mode === "paginated") goToPage(pageIndex + (forward ? 1 : -1));
        else el?.scrollBy({ top: (forward ? 1 : -1) * el.clientHeight * 0.88, behavior: "smooth" });
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "escape") {
        setTocOpen(false);
        setPanelOpen(false);
        setShortcutsOpen(false);
      } else if (k === "t") {
        setTocTab("toc");
        setTocOpen((v) => !v);
      } else if (k === "v" && settings.mode === "paginated") {
        setOverviewOpen((v) => !v);
      } else if (k === "o") {
        setListenOpen((v) => !v);
      } else if (k === "/" || k === "f") {
        e.preventDefault();
        setTocTab("search");
        setTocOpen(true);
      } else if (k === "a") {
        setPanelOpen((v) => !v);
      } else if (k === "m") {
        void handleAddBookmark();
      } else if (k === "?") {
        setShortcutsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // handleAddBookmark is recreated every render; the latest one is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.mode, pageIndex, goToPage]);

  // Ambient sound: browsers only allow audio after a gesture, so a saved
  // soundscape starts on the reader's first tap/key, and stops on exit.
  useEffect(() => {
    if (!hydrated) return;
    const kind = settings.ambient ?? "off";
    if (kind === "off") {
      stopAmbient();
      return;
    }
    const start = () => setAmbient(kind, settings.ambientVolume ?? 0.35);
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, [hydrated, settings.ambient, settings.ambientVolume]);
  useEffect(() => () => stopAmbient(), []);

  const theme = THEME_STYLES[settings.theme];
  const chapter = book.chapters[chapterIndex];
  // "Luz quente à noite": warms the page by itself from 20h to 6h.
  const [nightHours, setNightHours] = useState(false);
  useEffect(() => {
    const check = () => {
      const h = new Date().getHours();
      setNightHours(h >= 20 || h < 6);
    };
    check();
    const id = setInterval(check, 5 * 60_000);
    return () => clearInterval(id);
  }, []);
  const effectiveWarmth = Math.max(settings.warmth ?? 0, settings.autoWarm && nightHours ? 35 : 0);
  const darkPage =
    settings.theme === "gray" || settings.theme === "dark" || settings.theme === "amoled";
  // The app's own surfaces around the page (mockups 09–11).
  const chrome = darkPage
    ? {
        bar: "rgba(24,24,27,.92)",
        card: "#1c1c1f",
        surface2: "#2a2a2f",
        ink: "#f3f2ee",
        muted: "#a8a7a1",
        line: "#33333a",
        lilac: "#2c2852",
      }
    : {
        bar: "rgba(255,255,255,.92)",
        card: "#ffffff",
        surface2: "#ecebe6",
        ink: "#131313",
        muted: "#5c5b56",
        line: "#e4e2dc",
        lilac: "#e3e0ff",
      };

  const overallProgress = useMemo(() => {
    const per = 1 / book.chapters.length;
    return Math.min(1, chapterIndex * per + scrollRatio * per);
  }, [book.chapters.length, chapterIndex, scrollRatio]);

  // Word counts drive Kindle-style "time left" estimates (≈230 words/min).
  const chapterWords = useMemo(
    () =>
      book.chapters.map((c) =>
        c.paragraphs.reduce((n: number, p: string) => n + (p.match(/\S+/g)?.length ?? 0), 0),
      ),
    [book.chapters],
  );
  const WPM = 230;
  // A printed-book page holds ~250 words: gives "108 / 256" style locations.
  const totalWords = chapterWords.reduce((a, b) => a + b, 0);
  const bookPages = Math.max(1, Math.round(totalWords / 250));
  const bookPage = Math.min(bookPages, Math.max(1, Math.round(overallProgress * bookPages) || 1));

  const minutesLeftInChapter = Math.max(
    0,
    Math.ceil(((chapterWords[chapterIndex] ?? 0) * (1 - scrollRatio)) / WPM),
  );
  const minutesLeftInBook = Math.max(
    0,
    Math.ceil(
      ((chapterWords[chapterIndex] ?? 0) * (1 - scrollRatio) +
        chapterWords.slice(chapterIndex + 1).reduce((a, b) => a + b, 0)) /
        WPM,
    ),
  );

  // Feeds "Lendo agora" and the Início card with where you are.
  useEffect(() => {
    if (!hydrated) return;
    rememberLastBook(book.id, book.title, book.author, {
      progress: overallProgress,
      chapter: `Cap. ${romanize(chapterIndex + 1)}`,
      chapterMinutesLeft: minutesLeftInChapter,
      bookMinutesLeft: minutesLeftInBook,
      ...(book.cover && !book.cover.startsWith("data:") ? { cover: book.cover } : {}),
    });
  }, [
    hydrated,
    book.id,
    book.title,
    book.author,
    book.cover,
    overallProgress,
    chapterIndex,
    minutesLeftInChapter,
    minutesLeftInBook,
  ]);

  // /reader/…?ouvir=1 (the headphones buttons) opens straight into Ouvir.
  useEffect(() => {
    if (!hydrated) return;
    if (new URLSearchParams(window.location.search).get("ouvir")) setListenOpen(true);
  }, [hydrated]);

  const searchResults = useMemo(() => {
    const q = searchQuery
      .trim()
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (q.length < 2) return [];
    const out: {
      chapterIndex: number;
      paragraphIndex: number;
      before: string;
      match: string;
      after: string;
    }[] = [];
    book.chapters.forEach((c, ci) => {
      c.paragraphs.forEach((p: string, pi: number) => {
        if (out.length >= 80) return;
        const norm = p
          .toLocaleLowerCase("pt-BR")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const at = norm.indexOf(q);
        if (at < 0) return;
        out.push({
          chapterIndex: ci,
          paragraphIndex: pi,
          before: (at > 60 ? "…" : "") + p.slice(Math.max(0, at - 60), at),
          match: p.slice(at, at + q.length),
          after: p.slice(at + q.length, at + q.length + 80) + "…",
        });
      });
    });
    return out;
  }, [searchQuery, book.chapters]);

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
      suppressPageNavigationUntilRef.current = Date.now() + 900;

      const startOffset = offsetIn(startParagraph, range.startContainer, range.startOffset);
      const endOffset = offsetIn(endParagraph, range.endContainer, range.endOffset);
      if (startIndex === endIndex && endOffset <= startOffset) return;
      const context = chapter.paragraphs
        .slice(Math.max(0, startIndex - 1), Math.min(chapter.paragraphs.length, endIndex + 2))
        .join(" ")
        .slice(0, 1500);
      setActiveHighlightId(null);
      setControlsVisible(false);
      const box = range.getBoundingClientRect();
      setSelectedPassage({
        rect: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
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

  function askLumiAboutPassage(
    action: string,
    topic: "translation" | "explanation" | "character" | "flashcards",
    passage = selectedPassage,
  ) {
    if (!passage) return;
    openLumiPanel({
      bookTitle: book.title,
      bookAuthor: book.author,
      chapterTitle: chapter.title,
      chapterExcerpt: passage.context,
      selectedText: passage.text,
      topic,
      positionLabel: `Capítulo ${chapterIndex + 1} de ${book.chapters.length}`,
      initialPrompt: `${action} o trecho selecionado, considerando o contexto da leitura.`,
    });
    window.getSelection()?.removeAllRanges();
    setSelectedPassage(null);
  }

  async function handleHighlightColor(color: HighlightColor, openNote = false) {
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
      let first: Highlight | null = null;
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
        const h = await addHighlight(uid, book.id, {
          chapterId: chapter.id,
          chapterIndex,
          paragraphIndex,
          startOffset,
          endOffset,
          color,
          excerpt: paragraph.slice(startOffset, Math.min(endOffset, startOffset + 140)),
        });
        first ??= h;
        created += 1;
      }
      window.getSelection()?.removeAllRanges();
      setSelectedPassage(null);
      if (openNote && first) {
        setActiveHighlightId(first.id);
        setEditingNoteFor(first.id);
        setNoteDraft("");
      }
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
    jumpTo(b.chapterIndex, b.scrollRatio);
  }
  function jumpToHighlight(h: { chapterIndex: number; paragraphIndex?: number }) {
    const total = book.chapters[h.chapterIndex]?.paragraphs.length ?? 1;
    jumpTo(h.chapterIndex, (h.paragraphIndex ?? 0) / Math.max(1, total));
  }

  const readerFontFamily =
    READER_FONTS.find((f) => f.value === (settings.font ?? "serif"))?.family ?? "var(--font-book)";

  const isBookmarkedHere = annotations.bookmarks.some(
    (b) =>
      b.chapterIndex === chapterIndex &&
      Math.abs(b.scrollRatio - scrollRatio) <
        (settings.mode === "paginated" ? 0.5 / Math.max(1, pageCount - 1) : 0.03),
  );

  const wide = pageWidthPx >= 1000 || (typeof window !== "undefined" && window.innerWidth >= 1024);
  // Two pages side by side on wide screens (tablet landscape, desktop).
  const twoPageOn =
    settings.mode === "paginated" && settings.twoPage !== false && pageWidthPx >= 900;
  const columnWidthPx = twoPageOn ? pageWidthPx / 2 : pageWidthPx;
  const contentStyle: React.CSSProperties =
    settings.mode === "paginated"
      ? {
          columnWidth: pageWidthPx > 0 ? `${columnWidthPx}px` : "100%",
          columnGap: "0px",
          columnFill: "auto",
          height: "100%",
          overflowY: "hidden",
          overflowX: "auto",
          scrollbarWidth: "none",
          touchAction: "pan-y",
          padding: PAGE_PADDING,
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
      onPointerMove={(e) => {
        if (e.pointerType === "mouse") revealControls();
      }}
      onPointerUp={captureTextSelection}
    >
      {/* Quiet title while reading (mockup 08) */}
      {!settings.focusMode && (
        <p
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-20 truncate px-16 pt-[max(0.7rem,env(safe-area-inset-top))] text-center text-xs font-semibold transition-opacity duration-300 lg:hidden"
          style={{
            color: theme.muted,
            opacity: controlsVisible ? 0 : 1,
            fontFamily: "var(--font-sans)",
          }}
        >
          {book.title}
        </p>
      )}

      {/* Top bar (mockup 09) */}
      <header
        className={`absolute inset-x-0 top-0 z-30 transition-all duration-300 lg:pointer-events-auto lg:translate-y-0 lg:opacity-100 ${
          controlsVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-full opacity-0"
        }`}
        style={{
          background: wide ? "transparent" : chrome.bar,
          backdropFilter: wide ? "none" : "blur(16px)",
          WebkitBackdropFilter: wide ? "none" : "blur(16px)",
          boxShadow: wide ? "none" : `inset 0 -1px 0 ${chrome.line}`,
          fontFamily: "var(--font-sans)",
          color: wide ? theme.fg : chrome.ink,
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-3 pb-3 pt-[max(0.6rem,env(safe-area-inset-top))] lg:max-w-none lg:px-6 lg:pb-2 lg:pt-3">
          <Link
            to="/"
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full transition hover:opacity-70"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-6 w-6 lg:hidden" strokeWidth={2} />
            <ArrowLeft className="hidden h-[21px] w-[21px] lg:block" strokeWidth={2} />
          </Link>
          <span className="hidden lg:block">
            <IconBtn
              theme={theme}
              onClick={() => {
                setTocTab("toc");
                setTocOpen(true);
              }}
              label="Sumário (T)"
            >
              <List className="h-[21px] w-[21px]" />
            </IconBtn>
          </span>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[15px] font-bold leading-tight lg:hidden">{book.title}</p>
            <p className="mt-0.5 truncate text-xs lg:hidden" style={{ color: chrome.muted }}>
              Cap. {romanize(chapterIndex + 1)} · {chapter.title}
            </p>
            <p className="hidden truncate text-sm lg:block" style={{ color: theme.muted }}>
              <b style={{ color: theme.fg }}>{book.title}</b> · Cap. {romanize(chapterIndex + 1)} —{" "}
              {chapter.title}
            </p>
          </div>
          <IconBtn
            theme={theme}
            onClick={() => {
              setTocTab("search");
              setTocOpen(true);
            }}
            label="Buscar no livro (/)"
          >
            <SearchIcon className="h-5 w-5" style={{ color: wide ? theme.fg : chrome.ink }} />
          </IconBtn>
          <span className="hidden items-center lg:flex">
            <IconBtn theme={theme} onClick={() => setListenOpen(true)} label="Ouvir (O)">
              <Headphones className="h-5 w-5" />
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
                  topic: "question",
                })
              }
              label="Perguntar à Lumi"
            >
              <Sparkles className="h-5 w-5" />
            </IconBtn>
            <IconBtn theme={theme} onClick={() => setPanelOpen(true)} label="Aparência (A)">
              <ALargeSmall className="h-5 w-5" />
            </IconBtn>
          </span>
          <IconBtn theme={theme} onClick={handleAddBookmark} label="Marcar esta página (M)">
            <BookmarkIcon
              className="h-5 w-5"
              style={
                isBookmarkedHere
                  ? { fill: ACCENT, color: ACCENT }
                  : { color: wide ? theme.fg : chrome.ink }
              }
            />
          </IconBtn>
        </div>
      </header>

      {guest && guestTipOpen && controlsVisible && (
        <div
          data-reader-action="true"
          role="status"
          className="absolute left-1/2 top-[calc(max(0.5rem,env(safe-area-inset-top))+3.6rem)] z-30 flex w-[min(92vw,32rem)] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-2.5 text-xs shadow-lg"
          style={{ background: theme.fg, color: theme.bg, fontFamily: "var(--font-sans)" }}
        >
          <span className="min-w-0 flex-1 leading-snug">
            Lendo como convidado: seu progresso fica salvo neste aparelho.
          </span>
          <Link
            to="/auth"
            search={{ redirect: `/reader/${book.id}`, modo: "criar" }}
            className="shrink-0 font-semibold underline underline-offset-2"
          >
            Criar conta grátis
          </Link>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setGuestTipOpen(false)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full opacity-70 hover:opacity-100"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Content — a tap anywhere that isn't a control shows/hides the
          chrome, like a Kindle. Side zones (paginated) turn pages. */}
      <div
        className="relative flex-1 overflow-hidden"
        onTouchStart={settings.mode === "paginated" ? handlePaginatedTouchStart : undefined}
        onTouchMove={settings.mode === "paginated" ? handlePaginatedTouchMove : undefined}
        onTouchEnd={settings.mode === "paginated" ? handlePaginatedTouchEnd : undefined}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("[data-reader-action],button,a,input,textarea,mark,label")) return;
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) return;
          if (selectedPassage || activeHighlightId) return;
          if (controlsTimer.current) clearTimeout(controlsTimer.current);
          setControlsVisible((v) => !v);
        }}
      >
        <div
          ref={contentRef}
          onScroll={
            settings.mode === "scroll"
              ? onScroll
              : settings.mode === "paginated"
                ? onPaginatedScroll
                : undefined
          }
          style={contentStyle}
          className="h-full"
        >
          <article
            ref={articleRef}
            className={`mx-auto ${controlsVisible && !panelOpen ? "reader-dim" : ""}`}
            style={{
              maxWidth: twoPageOn ? "none" : `${settings.maxWidth}ch`,
              paddingInline:
                settings.mode === "paginated"
                  ? `${twoPageOn ? Math.max(56, (columnWidthPx - settings.fontSize * 26) / 2) : settings.margin}px`
                  : undefined,
              fontFamily: readerFontFamily,
              ["--reader-accent" as string]: theme.accent,
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              color: theme.fg,
              // The page steps back while the controls are up (mockup 09).
              transition: "opacity .3s ease",
            }}
          >
            <header className="mb-[22px] mt-2 text-center" style={{ breakInside: "avoid" }}>
              <p
                className="text-[10.5px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: theme.muted, fontFamily: "var(--font-sans)" }}
              >
                Capítulo {romanize(chapterIndex + 1)}
              </p>
              <h1
                className="mt-2.5 text-[1.5em] italic leading-[1.15] tracking-[-0.01em]"
                style={{ color: theme.fg, fontFamily: "inherit", fontWeight: 400 }}
              >
                {chapter.title}
              </h1>
              <div
                className="mx-auto mt-4 h-0.5 w-7 rounded-full"
                style={{ background: ACCENT }}
                aria-hidden
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
                    className={`rounded-sm px-2 -mx-2 py-0.5 [hyphens:auto] ${
                      i === 0 && /^[A-Za-zÀ-ÿ]/.test(p ?? "")
                        ? "first-letter:float-left first-letter:pr-2 first-letter:pt-[0.08em] first-letter:font-semibold first-letter:text-[3.2em] first-letter:leading-[0.78] first-letter:text-[var(--reader-accent)]"
                        : ""
                    }`}
                    style={{
                      marginBottom: 0,
                      textAlign: settings.alignment,
                      // Book-style paragraphs: indent instead of a blank line.
                      textIndent: i > 0 && settings.paragraphSpacing < 0.3 ? "1.4em" : undefined,
                    }}
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
                onClick={() => {
                  if (chapterIndex === book.chapters.length - 1) setChapterCompletionOpen(true);
                  else completeCurrentChapter();
                }}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-30"
                style={{ backgroundColor: theme.accent, color: theme.bg }}
              >
                {chapterIndex === book.chapters.length - 1 ? "Concluir livro" : "Próximo capítulo"}{" "}
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </article>
        </div>

        {twoPageOn && (
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[4rem] left-1/2 top-[4.25rem] w-px"
            style={{ background: theme.rule }}
          />
        )}
        {settings.mode === "paginated" && pageWidthPx >= 900 && (
          <>
            <ChevronLeft
              aria-hidden
              className="pointer-events-none absolute left-5 top-1/2 z-[4] h-7 w-7 -translate-y-1/2 opacity-50"
              style={{ color: theme.muted }}
              strokeWidth={1.6}
            />
            <ChevronRight
              aria-hidden
              className="pointer-events-none absolute right-5 top-1/2 z-[4] h-7 w-7 -translate-y-1/2 opacity-50"
              style={{ color: theme.muted }}
              strokeWidth={1.6}
            />
          </>
        )}
        {settings.mode === "paginated" && turn && (
          <TurnStage
            ref={stageRef}
            key={`${turn.from}-${turn.to}-${turn.style}`}
            snapshot={turn.snapshot}
            pageWidth={pageWidthPx}
            columnWidth={columnWidthPx}
            from={turn.from}
            to={turn.to}
            style={turn.style}
            bg={theme.bg}
            fg={theme.fg}
            padding={PAGE_PADDING}
          />
        )}
        {einkFlash && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-[6] bg-black" />
        )}

        {settings.mode === "paginated" && (settings.tapZones ?? "padrao") !== "deslizar" && (
          <>
            {(() => {
              const lefty = settings.tapZones === "canhoto";
              const back = (
                <button
                  data-tap-zone="true"
                  onClick={() => goToPage(pageIndex - 1)}
                  disabled={pageIndex === 0 && chapterIndex === 0}
                  aria-label="Página anterior"
                  className={`absolute inset-y-0 w-[28%] min-w-10 cursor-pointer disabled:cursor-default ${lefty ? "right-0" : "left-0"}`}
                />
              );
              const next = (
                <button
                  data-tap-zone="true"
                  onClick={() => goToPage(pageIndex + 1)}
                  disabled={
                    pageIndex === pageCount - 1 && chapterIndex === book.chapters.length - 1
                  }
                  aria-label="Próxima página"
                  className={`absolute inset-y-0 w-[38%] min-w-10 cursor-pointer disabled:cursor-default ${lefty ? "left-0" : "right-0"}`}
                />
              );
              return (
                <>
                  {back}
                  {next}
                </>
              );
            })()}
          </>
        )}

        {settings.mode === "paginated" && showPageGestureHint && !panelOpen && !tocOpen && (
          <button
            type="button"
            onClick={dismissPageGestureHint}
            className="fixed bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] left-1/2 z-[38] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full border px-4 py-2 text-center text-xs shadow-lg backdrop-blur-md transition hover:opacity-80"
            style={{
              borderColor: theme.rule,
              color: theme.fg,
              backgroundColor: theme.bg + "EB",
              fontFamily: "var(--font-sans)",
            }}
          >
            Toque na borda ou deslize para virar a página
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
              Você chegou ao final do livro.
            </p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: theme.muted }}>
              Confirme apenas uma vez para marcar o livro como concluído e atualizar sua estante.
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
                {completingChapter ? "Registrando…" : "Concluir livro"}
              </button>
            </div>
          </div>
        )}

        {(selectedPassage || activeHighlight) &&
          (() => {
            const r = selectedPassage?.rect;
            const vw = typeof window !== "undefined" ? window.innerWidth : 390;
            const W = Math.min(354, vw - 36);
            const centre = r ? (r.left + r.right) / 2 : vw / 2;
            const left = Math.max(18, Math.min(vw - W - 18, centre - W / 2));
            const above = r ? r.top > 150 : false;
            const pos: React.CSSProperties = r
              ? above
                ? { top: r.top - 124, left }
                : { top: r.bottom + 16, left }
              : { bottom: "max(5rem, calc(env(safe-area-inset-bottom) + 5rem))", left };
            const close = () => {
              window.getSelection()?.removeAllRanges();
              setSelectedPassage(null);
              setActiveHighlightId(null);
            };
            const actions: { icon: typeof List; label: string; on: () => void }[] = activeHighlight
              ? [
                  {
                    icon: NotebookPen,
                    label: "Nota",
                    on: () => {
                      setEditingNoteFor(activeHighlight.id);
                      setNoteDraft(activeHighlight.note ?? "");
                    },
                  },
                  {
                    icon: Copy,
                    label: "Copiar",
                    on: () =>
                      void navigator.clipboard
                        ?.writeText(activeHighlight.excerpt)
                        .then(() => toast.success("Copiado")),
                  },
                  {
                    icon: Share2,
                    label: "Citar",
                    on: () => void handleShareHighlight(activeHighlight),
                  },
                  {
                    icon: Trash2,
                    label: "Remover",
                    on: () => {
                      void removeHighlight(uid, book.id, activeHighlight.id);
                      setActiveHighlightId(null);
                    },
                  },
                  {
                    icon: Sparkles,
                    label: "Lumi",
                    on: () => askLumiAboutPassage("Explique em linguagem simples", "explanation"),
                  },
                ]
              : [
                  {
                    icon: NotebookPen,
                    label: "Nota",
                    on: () => void handleHighlightColor("gold", true),
                  },
                  {
                    icon: Copy,
                    label: "Copiar",
                    on: () => {
                      void navigator.clipboard
                        ?.writeText(selectedPassage!.text)
                        .then(() => toast.success("Copiado"));
                      close();
                    },
                  },
                  {
                    icon: BookA,
                    label: "Definir",
                    on: () =>
                      askLumiAboutPassage(
                        "Defina esta palavra ou expressão, em uma frase, no sentido usado no texto",
                        "explanation",
                      ),
                  },
                  {
                    icon: Languages,
                    label: "Traduzir",
                    on: () =>
                      askLumiAboutPassage("Traduza para português do Brasil", "translation"),
                  },
                  {
                    icon: Sparkles,
                    label: "Lumi",
                    on: () => askLumiAboutPassage("Explique em linguagem simples", "explanation"),
                  },
                ];
            return (
              <div
                data-reader-action="true"
                role="toolbar"
                aria-label="Ações do trecho"
                className="fixed z-[70] rounded-[20px] p-2.5 text-white shadow-[0_20px_40px_-12px_rgba(0,0,0,.5)]"
                style={{ ...pos, width: W, background: "#1b1b1d", fontFamily: "var(--font-sans)" }}
              >
                <div className="flex items-center gap-2.5 border-b border-white/[.12] px-1.5 pb-2.5">
                  {(["gold", "green", "blue", "pink", "lilac"] as HighlightColor[]).map((color) => (
                    <button
                      key={color}
                      data-reader-action="true"
                      onClick={() => void handleHighlightColor(color)}
                      aria-label={`Destacar em ${color}`}
                      className="h-[26px] w-[26px] rounded-full transition hover:scale-110"
                      style={{
                        backgroundColor: HIGHLIGHT_ACCENT[color],
                        boxShadow:
                          activeHighlight?.color === color
                            ? "0 0 0 2px #1b1b1d, 0 0 0 4px #fff"
                            : undefined,
                      }}
                    />
                  ))}
                  <span className="flex-1" />
                  <button
                    data-reader-action="true"
                    aria-label="Fechar"
                    onClick={close}
                    className="grid h-7 w-7 place-items-center rounded-full text-white/70"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex justify-between px-1 pt-2.5">
                  {actions.map((a) => (
                    <button
                      key={a.label}
                      data-reader-action="true"
                      onClick={a.on}
                      className="flex w-14 flex-col items-center gap-1.5 text-[11px] font-semibold transition hover:opacity-75"
                    >
                      <a.icon className="h-[19px] w-[19px]" strokeWidth={2} />
                      {a.label}
                    </button>
                  ))}
                </div>
                {r && (
                  <i
                    aria-hidden
                    className="absolute h-3.5 w-3.5 rotate-45"
                    style={{
                      background: "#1b1b1d",
                      left: Math.max(16, Math.min(W - 30, centre - left - 7)),
                      ...(above ? { bottom: -7 } : { top: -7 }),
                    }}
                  />
                )}
              </div>
            );
          })()}
      </div>

      {/* Night light + dimmer, like a Kindle's warm light and brightness. */}
      {effectiveWarmth > 0 && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[35] mix-blend-multiply"
          style={{ background: `rgba(255, 146, 40, ${(effectiveWarmth / 100) * 0.38})` }}
        />
      )}
      {(settings.dim ?? 0) > 0 && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[36]"
          style={{ background: `rgba(0, 0, 0, ${(settings.dim ?? 0) / 100})` }}
        />
      )}

      {/* Quiet footer while reading — tap to cycle what it shows (mockup 08) */}
      {!settings.focusMode && (
        <button
          type="button"
          data-reader-action="true"
          onClick={() => {
            const order: NonNullable<ReaderSettings["footer"]>[] = [
              "capitulo",
              "livro",
              "pagina",
              "percent",
              "nada",
            ];
            const cur = settings.footer ?? "capitulo";
            setSettings((s) => ({
              ...s,
              footer: order[(order.indexOf(cur) + 1) % order.length],
              updatedAt: Date.now(),
            }));
          }}
          aria-label="Alternar informação do rodapé"
          className={`absolute inset-x-0 bottom-0 z-20 px-[30px] pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-2 text-left transition-opacity duration-300 lg:pointer-events-auto lg:px-10 lg:pb-5 lg:opacity-100 ${
            controlsVisible ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          style={{ fontFamily: "var(--font-sans)", color: theme.muted }}
        >
          <span className="hidden items-center gap-6 text-[12.5px] font-semibold lg:flex">
            <span className="shrink-0">
              {twoPageOn
                ? `Pág. ${bookPage}–${Math.min(bookPages, bookPage + 1)} de ${bookPages}`
                : `Pág. ${bookPage} de ${bookPages}`}
            </span>
            <span
              className="h-1 flex-1 overflow-hidden rounded-full"
              style={{ background: theme.rule }}
            >
              <span
                className="block h-full rounded-full"
                style={{ width: `${overallProgress * 100}%`, background: theme.fg }}
              />
            </span>
            <span className="shrink-0">
              {minutesLeftInChapter <= 1 ? "Menos de 1 min" : `${minutesLeftInChapter} min`}{" "}
              restantes no capítulo
            </span>
          </span>
          {(settings.footer ?? "capitulo") !== "nada" && (
            <span className="flex items-center justify-between text-xs font-semibold lg:hidden">
              <span>
                {(settings.footer ?? "capitulo") === "capitulo"
                  ? minutesLeftInChapter <= 1
                    ? "Menos de 1 min restante no capítulo"
                    : `${minutesLeftInChapter} min restantes no capítulo`
                  : settings.footer === "livro"
                    ? `${formatDuration(minutesLeftInBook)} restantes no livro`
                    : settings.footer === "pagina"
                      ? `Página ${bookPage} de ${bookPages}`
                      : `${Math.round(overallProgress * 100)}% lido`}
              </span>
              <span className="tabular-nums">
                {bookPage} / {bookPages}
              </span>
            </span>
          )}
          <span
            className="mt-2 block h-[3px] overflow-hidden rounded-full lg:hidden"
            style={{ background: theme.rule }}
          >
            <span
              className="block h-full rounded-full"
              style={{ width: `${overallProgress * 100}%`, background: theme.fg }}
            />
          </span>
        </button>
      )}

      {/* Controls card (mockup 09) */}
      <div
        data-reader-action="true"
        className={`absolute inset-x-3 bottom-[max(1.6rem,calc(env(safe-area-inset-bottom)+0.6rem))] z-30 mx-auto max-w-[560px] rounded-[30px] lg:hidden px-[18px] pb-3.5 pt-[18px] transition-all duration-300 ${
          controlsVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-[120%] opacity-0"
        }`}
        style={{
          background: chrome.card,
          color: chrome.ink,
          fontFamily: "var(--font-sans)",
          boxShadow: `0 24px 60px -20px rgba(0,0,0,.35), inset 0 0 0 1px ${chrome.line}`,
        }}
      >
        {(() => {
          const n = book.chapters.length;
          const value = scrubValue ?? Math.round(overallProgress * 1000);
          const previewChapter = Math.min(n - 1, Math.floor((value / 1000) * n));
          const pct = value / 10;
          const commit = () => {
            if (scrubValue === null) return;
            const v = scrubValue / 1000;
            const target = Math.min(n - 1, Math.floor(v * n));
            jumpTo(target, Math.min(1, v * n - target));
            setScrubValue(null);
          };
          return (
            <div className="relative h-14">
              <button
                type="button"
                onClick={() => settings.mode === "paginated" && setOverviewOpen(true)}
                title="Visão geral das páginas"
                className="absolute top-0 h-8 -translate-x-1/2 whitespace-nowrap rounded-[10px] px-3 text-xs font-semibold"
                style={{
                  left: `clamp(86px, ${pct}%, calc(100% - 86px))`,
                  background: chrome.ink,
                  color: chrome.card,
                }}
              >
                Cap. {romanize(previewChapter + 1)}
                {scrubValue === null && settings.mode === "paginated"
                  ? ` · pág. ${bookPage}`
                  : ` · ${Math.round(pct)}%`}
              </button>
              <div
                className="absolute inset-x-0 top-[44px] h-1.5 overflow-hidden rounded-full"
                style={{ background: chrome.surface2 }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: ACCENT }}
                />
              </div>
              {n > 1 &&
                n <= 60 &&
                Array.from({ length: n - 1 }, (_, i) => (
                  <i
                    key={i}
                    className="absolute top-[44px] h-1.5 w-0.5"
                    style={{ left: `${((i + 1) / n) * 100}%`, background: "rgba(0,0,0,.14)" }}
                  />
                ))}
              <input
                type="range"
                min={0}
                max={1000}
                value={value}
                aria-label="Localização no livro"
                aria-valuetext={`${Math.round(pct)}%, capítulo ${previewChapter + 1}`}
                onChange={(e) => setScrubValue(Number(e.target.value))}
                onPointerUp={commit}
                onKeyUp={commit}
                onBlur={commit}
                className="scrub-range absolute inset-x-[-11px] top-[36px] w-[calc(100%+22px)]"
                style={{ ["--scrub-accent" as string]: ACCENT }}
              />
            </div>
          );
        })()}
        <div
          className="mt-1 flex items-center justify-between text-xs font-semibold"
          style={{ color: chrome.muted }}
        >
          <span>{Math.round(overallProgress * 100)}% lido</span>
          <span>{formatDuration(minutesLeftInBook)} para terminar</span>
        </div>
        <div className="mt-4 flex justify-between">
          {(
            [
              {
                icon: List,
                label: "Sumário",
                on: () => {
                  setTocTab("toc");
                  setTocOpen(true);
                },
              },
              { icon: Headphones, label: "Ouvir", on: () => setListenOpen(true) },
              {
                icon: NotebookPen,
                label: "Notas",
                on: () => {
                  setTocTab("highlights");
                  setTocOpen(true);
                },
              },
              {
                icon: Sparkles,
                label: "Lumi",
                lumi: true,
                on: () =>
                  openLumiPanel({
                    bookTitle: book.title,
                    bookAuthor: book.author,
                    chapterTitle: chapter.title,
                    chapterExcerpt: chapter.paragraphs.slice(0, 3).join(" "),
                    positionLabel: `Capítulo ${chapterIndex + 1} de ${book.chapters.length}`,
                    topic: "question",
                  }),
              },
              { icon: ALargeSmall, label: "Aparência", on: () => setPanelOpen(true) },
            ] as { icon: typeof List; label: string; lumi?: boolean; on: () => void }[]
          ).map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.on}
              className="press flex w-[62px] flex-col items-center gap-1.5"
            >
              <span
                className="grid h-[50px] w-[50px] place-items-center rounded-[18px]"
                style={
                  btn.lumi
                    ? { background: chrome.lilac, color: "#4a3df0" }
                    : { background: chrome.surface2 }
                }
              >
                <btn.icon className="h-[21px] w-[21px]" strokeWidth={2} />
              </span>
              <span className="text-[11px] font-semibold" style={{ color: chrome.muted }}>
                {btn.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <AnimatePresence>
        {shortcutsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setShortcutsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[1.75rem] p-6 shadow-2xl"
              style={{
                background: theme.bg,
                color: theme.fg,
                fontFamily: "var(--font-sans)",
                border: `1px solid ${theme.rule}`,
              }}
            >
              <p className="font-display text-3xl">Atalhos</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[
                  ["→  Espaço  PgDn", "Próxima página"],
                  ["←  Shift+Espaço  PgUp", "Página anterior"],
                  ["T", "Sumário"],
                  ["/  F", "Buscar no livro"],
                  ["A", "Aparência"],
                  ["M", "Marcar página"],
                  ["Esc", "Fechar painéis"],
                ].map(([k, d]) => (
                  <li key={k} className="flex items-center justify-between gap-4">
                    <span style={{ color: theme.muted }}>{d}</span>
                    <kbd
                      className="rounded-md px-2 py-0.5 text-xs"
                      style={{ boxShadow: `inset 0 0 0 1px ${theme.rule}` }}
                    >
                      {k}
                    </kbd>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs" style={{ color: theme.muted }}>
                No celular: toque nas bordas para virar a página e no centro para mostrar os
                controles.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings panel */}
      <ListenMode
        open={listenOpen}
        onClose={() => setListenOpen(false)}
        title={book.title}
        author={book.author}
        cover={book.cover}
        chapterLabel={`Cap. ${romanize(chapterIndex + 1)} · ${chapter.title}`}
        paragraphs={chapter.paragraphs}
        startParagraph={Math.floor(scrollRatio * Math.max(0, chapter.paragraphs.length - 1))}
        onChapterEnd={() => {
          if (chapterIndex < book.chapters.length - 1) {
            goto(chapterIndex + 1, 0);
            setTimeout(() => setListenOpen(true), 400);
          }
        }}
      />

      {settings.mode === "paginated" && overviewOpen && articleRef.current && (
        <PageOverview
          snapshot={articleRef.current.outerHTML}
          pageWidth={pageWidthPx}
          columnWidth={columnWidthPx}
          padding={PAGE_PADDING}
          pageCount={pageCount}
          current={pageIndex}
          bg={theme.bg}
          fg={theme.fg}
          label={`Cap. ${romanize(chapterIndex + 1)} · ${Math.round(overallProgress * 100)}%`}
          progress={overallProgress}
          onPick={(i) => {
            setOverviewOpen(false);
            if (i !== pageIndex) commitPage(i);
          }}
          onClose={() => setOverviewOpen(false)}
        />
      )}

      <ReaderSettingsPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        settings={settings}
        onChange={(patch) => setSettings((s) => ({ ...s, ...patch, updatedAt: Date.now() }))}
        theme={theme}
      />

      {/* Table of contents / highlights / bookmarks */}
      <AnimatePresence>
        {tocOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setTocOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed left-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-r shadow-2xl"
              style={{
                backgroundColor: theme.bg,
                color: theme.fg,
                borderColor: theme.rule,
                fontFamily: "var(--font-sans)",
              }}
            >
              <div className="border-b px-5 py-4" style={{ borderColor: theme.rule }}>
                <h3 className="font-display text-3xl leading-tight">{book.title}</h3>
                <p className="text-xs" style={{ color: theme.muted }}>
                  {book.author} · {Math.round(overallProgress * 100)}% lido ·{" "}
                  {formatDuration(minutesLeftInBook)} restantes
                </p>
                <div
                  className="mt-3 grid grid-cols-4 gap-1 rounded-full p-1"
                  style={{ backgroundColor: theme.rule, fontFamily: "var(--font-sans)" }}
                >
                  {(
                    [
                      { key: "toc", label: "Sumário" },
                      { key: "highlights", label: "Destaques" },
                      { key: "bookmarks", label: "Marcadores" },
                      { key: "search", label: "Buscar" },
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
                            <span
                              className="text-[10px] tabular-nums"
                              style={{ color: theme.muted }}
                            >
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
              {tocTab === "search" && (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="p-3">
                    <label
                      className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
                      style={{ boxShadow: `inset 0 0 0 1px ${theme.rule}` }}
                    >
                      <SearchIcon className="h-4 w-4 shrink-0" style={{ color: theme.muted }} />
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar palavras neste livro"
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                        style={{ color: theme.fg }}
                        aria-label="Buscar no livro"
                      />
                    </label>
                    <p className="mt-2 px-1 text-[11px]" style={{ color: theme.muted }}>
                      {searchQuery.trim().length < 2
                        ? "Digite pelo menos 2 letras. Acentos são ignorados."
                        : searchResults.length === 0
                          ? "Nada encontrado."
                          : `${searchResults.length}${searchResults.length >= 80 ? "+" : ""} trechos encontrados`}
                    </p>
                  </div>
                  <ul className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
                    {searchResults.map((r) => (
                      <li key={`${r.chapterIndex}-${r.paragraphIndex}`}>
                        <button
                          onClick={() =>
                            jumpTo(
                              r.chapterIndex,
                              r.paragraphIndex /
                                Math.max(1, book.chapters[r.chapterIndex]?.paragraphs.length ?? 1),
                            )
                          }
                          className="w-full rounded-xl px-3 py-2.5 text-left text-sm transition hover:opacity-80"
                          style={{ boxShadow: `inset 0 0 0 1px ${theme.rule}` }}
                        >
                          <span
                            className="block truncate text-[10px] uppercase tracking-wider"
                            style={{ color: theme.muted }}
                          >
                            Cap. {r.chapterIndex + 1} · {book.chapters[r.chapterIndex]?.title}
                          </span>
                          <span
                            className="mt-0.5 block leading-relaxed"
                            style={{ fontFamily: readerFontFamily }}
                          >
                            {r.before}
                            <mark
                              className="rounded-sm px-0.5"
                              style={{ background: theme.accent + "40", color: "inherit" }}
                            >
                              {r.match}
                            </mark>
                            {r.after}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
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
      title={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:opacity-70 active:scale-95"
      style={{ color: theme.fg }}
    >
      {children}
    </button>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
