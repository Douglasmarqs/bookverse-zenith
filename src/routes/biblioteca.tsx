import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownUp,
  BookOpen,
  Compass,
  FileUp,
  Check,
  ChevronLeft,
  Download,
  FileText,
  Heart,
  LayoutGrid,
  LibraryBig,
  List as ListIcon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { BookArt } from "@/components/book-art";
import { Bookshelf } from "@/components/library/bookshelf";
import { bookFormat } from "@/lib/book-format";
import { Lumi } from "@/components/brand/lumi";
import { useAccount } from "@/hooks/use-auth-user";
import { describeFirestoreError } from "@/lib/async-utils";
import { forgetDownloadedReaderId } from "@/lib/catalog";
import { forgetDeviceBook, useDeviceBooks, type DeviceBook } from "@/lib/device-books";
import { deleteEpubBook, deleteEpubBookFromCloud, isEpubReaderId } from "@/lib/epub-store";
import {
  removeFromLibrary,
  setFavorite,
  setLibraryStatus,
  setRating,
  slugFor,
  subscribeLibrary,
  updateLibraryCover,
  type LibraryEntry,
  type LibraryStatus,
} from "@/lib/library";
import {
  deletePdfBook,
  deletePdfBookFromCloud,
  getPdfCoverFromCloud,
  isPdfReaderId,
} from "@/lib/pdf-store";
import {
  loadProgressLocal,
  subscribeReadingProgress,
  type ReadingProgress,
} from "@/lib/reader-store";
import { coverIn, playBookOpen } from "@/lib/book-motion";

export const Route = createFileRoute("/biblioteca")({
  head: () => ({
    meta: [
      { title: "Biblioteca — BookVerse" },
      { name: "description", content: "Seus livros: lendo, quero ler, lidos e listas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BibliotecaPage,
});

/* --------------------------------- model -------------------------------- */

type Tab = "lendo" | "quero-ler" | "lidos" | "listas";
type ListId = "favoritos" | "relendo" | "abandonados" | "offline" | "arquivos";
type SortKey = "lidos" | "adicionados" | "titulo" | "autor" | "nota";
type View = "estante" | "grade" | "lista";

/** One shelf item, from the account library or (for guests) this device. */
interface ShelfBook {
  id: string;
  title: string;
  author: string;
  cover?: string | null;
  readerId?: string | null;
  status: LibraryStatus;
  favorite?: boolean;
  rating?: number;
  progress: number;
  lastRead: number;
  addedAt: number;
  /** Present when the file lives on this device. */
  device?: DeviceBook;
  entry?: LibraryEntry;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "lendo", label: "Lendo" },
  { id: "quero-ler", label: "Quero ler" },
  { id: "lidos", label: "Lidos" },
  { id: "listas", label: "Listas" },
];

const LISTS: { id: ListId; label: string; hint: string; icon: typeof Heart; tint: string }[] = [
  {
    id: "favoritos",
    label: "Favoritos",
    hint: "os que você guardou no coração",
    icon: Heart,
    tint: "var(--rose)",
  },
  { id: "relendo", label: "Relendo", hint: "voltando a eles", icon: RotateCcw, tint: "var(--sky)" },
  {
    id: "offline",
    label: "Baixados no aparelho",
    hint: "abrem sem internet",
    icon: Download,
    tint: "var(--mint)",
  },
  {
    id: "arquivos",
    label: "Meus arquivos",
    hint: "EPUB, PDF e outros que você importou",
    icon: FileText,
    tint: "var(--butter)",
  },
  {
    id: "abandonados",
    label: "Deixados de lado",
    hint: "sem culpa",
    icon: XCircle,
    tint: "var(--lilac)",
  },
];

const SORT_LABEL: Record<SortKey, string> = {
  lidos: "Lidos recentemente",
  adicionados: "Adicionados recentemente",
  titulo: "Título (A–Z)",
  autor: "Autor (A–Z)",
  nota: "Melhor avaliados",
};

const STATUS_LABEL: Record<LibraryStatus, string> = {
  lendo: "Lendo",
  "quero-ler": "Quero ler",
  concluido: "Lido",
  relendo: "Relendo",
  abandonado: "Deixado de lado",
};

const VIEW_KEY = "bookverse:library-view";

function ratio(p?: ReadingProgress | null): number {
  if (!p) return 0;
  const r =
    p.overallRatio ??
    ((p.chapterIndex ?? 0) + (p.scrollRatio ?? 0)) / Math.max(1, p.chapterCount ?? 1);
  return Math.max(0, Math.min(1, r));
}

function millis(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const t = v as { toMillis?: () => number; seconds?: number };
  return t.toMillis?.() ?? (t.seconds ? t.seconds * 1000 : 0);
}

const isPersonalFile = (id?: string | null) => !!id && (isEpubReaderId(id) || isPdfReaderId(id));

/* --------------------------------- page --------------------------------- */

function BibliotecaPage() {
  const { state: account, user } = useAccount();
  const member = account === "member";
  const uid = member && user ? user.uid : null;
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const device = useDeviceBooks();

  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [progress, setProgress] = useState<Map<string, ReadingProgress & { bookId: string }>>(
    () => new Map(),
  );
  const [tab, setTab] = useState<Tab>("lendo");
  const [list, setList] = useState<ListId | null>(null);
  const [sort, setSort] = useState<SortKey>("lidos");
  const [sortOpen, setSortOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("estante");
  const [sheet, setSheet] = useState<ShelfBook | null>(null);
  const coverRecovery = useRef(new Set<string>());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "lista" || saved === "grade" || saved === "estante") setView(saved);
    } catch {
      // ignore
    }
  }, []);
  function changeView(v: View) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!uid) {
      setEntries(null);
      return;
    }
    const unsubs = [
      subscribeLibrary(uid, setEntries),
      subscribeReadingProgress(uid, (items) =>
        setProgress(new Map(items.map((p) => [p.bookId, p]))),
      ),
    ];
    const t = setTimeout(() => setEntries((e) => e ?? []), 10000);
    return () => {
      unsubs.forEach((u) => u());
      clearTimeout(t);
    };
  }, [uid]);

  // PDFs imported before covers existed get one from their cloud copy.
  useEffect(() => {
    if (!uid || !entries) return;
    for (const e of entries) {
      if (e.cover || !e.readerId || !isPdfReaderId(e.readerId)) continue;
      if (coverRecovery.current.has(e.readerId)) continue;
      coverRecovery.current.add(e.readerId);
      void getPdfCoverFromCloud(uid, e.readerId).then((c) => {
        if (c) void updateLibraryCover(uid, e.id, c);
      });
    }
  }, [entries, uid]);

  const books: ShelfBook[] | null = useMemo(() => {
    const byReader = new Map(device.map((d) => [d.id, d]));
    if (account === "loading") return null;
    if (uid) {
      if (!entries) return null;
      return entries.map((e) => {
        const p = e.readerId ? (progress.get(e.readerId) ?? loadProgressLocal(e.readerId)) : null;
        return {
          id: e.id,
          title: e.title,
          author: e.author,
          cover: e.cover,
          readerId: e.readerId,
          status: e.status,
          favorite: e.favorite,
          rating: e.rating,
          progress: e.status === "concluido" ? 1 : ratio(p),
          lastRead: p?.updatedAt ?? 0,
          addedAt: millis(e.addedAt),
          device: e.readerId ? byReader.get(e.readerId) : undefined,
          entry: e,
        };
      });
    }
    // Guests: the books kept on this device.
    return device.map((d) => {
      const p = loadProgressLocal(d.id);
      const r = ratio(p);
      return {
        id: d.id,
        title: d.title,
        author: d.author,
        readerId: d.id,
        status: (r >= 0.99 ? "concluido" : p ? "lendo" : "quero-ler") as LibraryStatus,
        progress: r,
        lastRead: p?.updatedAt ?? 0,
        addedAt: d.addedAt,
        device: d,
      };
    });
  }, [account, uid, entries, progress, device]);

  const inTab = (b: ShelfBook, t: Tab) =>
    t === "lendo"
      ? b.status === "lendo" || b.status === "relendo"
      : t === "quero-ler"
        ? b.status === "quero-ler"
        : t === "lidos"
          ? b.status === "concluido"
          : false;

  const inList = (b: ShelfBook, l: ListId) =>
    l === "favoritos"
      ? !!b.favorite
      : l === "relendo"
        ? b.status === "relendo"
        : l === "abandonados"
          ? b.status === "abandonado"
          : l === "offline"
            ? !!b.device
            : isPersonalFile(b.readerId);

  const counts = useMemo(() => {
    const c = { lendo: 0, "quero-ler": 0, lidos: 0, listas: LISTS.length } as Record<Tab, number>;
    for (const b of books ?? [])
      for (const t of ["lendo", "quero-ler", "lidos"] as Tab[]) if (inTab(b, t)) c[t] += 1;
    return c;
  }, [books]);

  const visible = useMemo(() => {
    let out = (books ?? []).filter((b) => (list ? inList(b, list) : inTab(b, tab)));
    const q = query.trim().toLowerCase();
    if (q) {
      out = (books ?? []).filter(
        (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q),
      );
    }
    const s = [...out];
    if (sort === "titulo") s.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    else if (sort === "autor") s.sort((a, b) => a.author.localeCompare(b.author, "pt-BR"));
    else if (sort === "nota") s.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else if (sort === "adicionados") s.sort((a, b) => b.addedAt - a.addedAt);
    else s.sort((a, b) => b.lastRead - a.lastRead || b.addedAt - a.addedAt);
    // "Lendo" continues with what's next in the queue, marked "Novo".
    if (!list && !q && tab === "lendo") {
      const next = (books ?? [])
        .filter((b) => b.status === "quero-ler")
        .sort((a, b) => b.addedAt - a.addedAt)
        .slice(0, 9);
      s.push(...next);
    }
    return s;
  }, [books, tab, list, sort, query]);

  function open(b: ShelfBook) {
    if (b.readerId) void navigate({ to: "/reader/$bookId", params: { bookId: b.readerId } });
    else
      void navigate({
        to: "/livro/$slug",
        params: { slug: slugFor(b.title, b.author) || "livro" },
        search: { title: b.title, author: b.author, ...(b.cover ? { cover: b.cover } : {}) },
      });
  }

  const showingLists = tab === "listas" && !list && !query.trim();

  return (
    <div className="mx-auto max-w-5xl pb-10 pt-[calc(env(safe-area-inset-top)+0.875rem)] lg:px-6 lg:pt-10">
      <header className="flex items-center justify-between gap-3 px-[22px] pt-2 lg:px-4">
        <h1 className="min-w-0 font-display text-[clamp(30px,9vw,44px)] leading-none tracking-[-0.035em] lg:text-[56px]">
          Biblioteca
        </h1>
        <div className="flex items-center gap-2.5">
          <Link
            to="/adicionar"
            search={{}}
            aria-label="Adicionar livros: importar arquivos ou baixar grátis"
            className="press inline-flex h-[44px] items-center gap-1.5 rounded-full bg-foreground shrink-0 pl-3 pr-4 max-[339px]:pr-3 text-[14.5px] font-semibold text-background"
          >
            <Plus className="h-[20px] w-[20px]" strokeWidth={2.4} />
            <span className="max-[339px]:hidden">Adicionar</span>
          </Link>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 lg:px-4"
          >
            <label className="mt-4 flex h-12 items-center gap-2.5 rounded-[16px] bg-card px-3.5 shadow-[inset_0_0_0_1px_var(--border)]">
              <Search className="h-[18px] w-[18px] text-faint" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Título ou autor na sua biblioteca"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
              />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Estantes"
        className="mx-4 mt-5 grid grid-cols-4 rounded-[20px] bg-surface-2 p-1 lg:max-w-xl"
      >
        {TABS.map((t) => {
          const on = tab === t.id && !query.trim();
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => {
                setTab(t.id);
                setList(null);
                setQuery("");
                if (t.id === "lidos" && sort === "lidos") setSort("lidos");
              }}
              className={`relative rounded-[16px] py-2 text-center transition-colors ${
                on ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {on && (
                <motion.span
                  layoutId="lib-tab"
                  transition={
                    reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }
                  }
                  className="absolute inset-0 rounded-[16px] bg-card shadow-[0_2px_8px_rgba(0,0,0,.07)]"
                />
              )}
              <span className="relative block text-[14.5px] font-semibold">{t.label}</span>
              <span className="num relative block text-[13.5px] text-faint">
                {books ? counts[t.id] : "–"}
              </span>
            </button>
          );
        })}
      </div>

      {account === "guest" && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-[18px] bg-accent-soft px-3.5 py-3">
          <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-[#7a2c12]">
            Mostrando os livros deste aparelho. Entre para guardar sua estante e ler em qualquer
            lugar.
          </p>
          <Link
            to="/auth"
            search={{ redirect: "/biblioteca" }}
            className="press shrink-0 rounded-full bg-foreground px-3.5 py-2 text-[12.5px] font-semibold text-background"
          >
            Entrar
          </Link>
        </div>
      )}

      {showingLists ? (
        <ListsView books={books ?? []} inList={inList} onOpen={setList} />
      ) : (
        <>
          {/* Sort + view */}
          <div className="mt-5 flex items-center justify-between px-[22px] lg:px-4">
            {list ? (
              <button
                type="button"
                onClick={() => setList(null)}
                className="press -ml-1 flex items-center gap-1 text-[15px] font-semibold"
              >
                <ChevronLeft className="h-5 w-5" />
                {LISTS.find((l) => l.id === list)?.label}
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSortOpen((o) => !o)}
                  aria-expanded={sortOpen}
                  className="press flex min-w-0 items-center gap-2 whitespace-nowrap text-[15px] font-semibold text-muted-foreground max-[359px]:text-[13.5px]"
                >
                  <ArrowDownUp className="h-[17px] w-[17px]" strokeWidth={2.1} />
                  {query.trim() ? "Resultados" : SORT_LABEL[sort]}
                </button>
                <AnimatePresence>
                  {sortOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Fechar"
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => setSortOpen(false)}
                      />
                      <motion.ul
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        className="absolute left-0 top-9 z-40 w-60 rounded-[18px] bg-popover p-1.5 shadow-xl ring-1 ring-border"
                      >
                        {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                          <li key={k}>
                            <button
                              type="button"
                              onClick={() => {
                                setSort(k);
                                setSortOpen(false);
                              }}
                              className="flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left text-[14px] font-medium hover:bg-surface-2"
                            >
                              {SORT_LABEL[k]}
                              {sort === k && <Check className="h-4 w-4 text-gold" />}
                            </button>
                          </li>
                        ))}
                      </motion.ul>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((o) => !o);
                  if (searchOpen) setQuery("");
                }}
                aria-label={searchOpen ? "Fechar busca" : "Buscar na biblioteca"}
                aria-pressed={searchOpen}
                className={`press grid h-[42px] w-[42px] place-items-center rounded-full transition ${
                  searchOpen ? "bg-card shadow-[inset_0_0_0_1px_var(--border)]" : "text-faint"
                }`}
              >
                {searchOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Search className="h-5 w-5" strokeWidth={2} />
                )}
              </button>
              {(
                [
                  ["estante", LibraryBig, "Estante"],
                  ["grade", LayoutGrid, "Grade"],
                  ["lista", ListIcon, "Lista"],
                ] as const
              ).map(([v, Icon, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-label={`Ver em ${label.toLowerCase()}`}
                  aria-pressed={view === v}
                  onClick={() => changeView(v)}
                  className={`press grid h-[42px] w-[42px] place-items-center rounded-full transition ${
                    view === v ? "bg-card shadow-[inset_0_0_0_1px_var(--border)]" : "text-faint"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>

          {books === null ? (
            <GridSkeleton />
          ) : visible.length === 0 ? (
            <EmptyShelf tab={tab} list={list} query={query} total={books.length} />
          ) : view === "estante" ? (
            <Bookshelf
              books={visible}
              label={
                query.trim()
                  ? "Resultados"
                  : list
                    ? (LISTS.find((l) => l.id === list)?.label ?? "Estante")
                    : `${TABS.find((t) => t.id === tab)?.label ?? "Estante"} · ${visible.length}`
              }
              onOpen={(b) => open(b as ShelfBook)}
              onMore={(b) => setSheet(b as ShelfBook)}
            />
          ) : view === "grade" ? (
            <ul className="reveal-flow mt-4 grid grid-cols-3 gap-x-4 gap-y-7 px-[22px] sm:grid-cols-4 lg:grid-cols-6 lg:px-4">
              <AnimatePresence initial={false}>
                {visible.map((b, i) => (
                  <GridItem
                    key={b.id}
                    book={b}
                    index={i}
                    onOpen={() => open(b)}
                    onMore={() => setSheet(b)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <ul className="surface-card mx-4 mt-4 px-3.5 lg:mx-4">
              {visible.map((b, i) => (
                <RowItem
                  key={b.id}
                  book={b}
                  last={i === visible.length - 1}
                  onOpen={() => open(b)}
                  onMore={() => setSheet(b)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {sheet && (
              <BookSheet
                book={sheet}
                uid={uid}
                onOpen={() => {
                  open(sheet);
                  setSheet(null);
                }}
                onClose={() => setSheet(null)}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

/* ------------------------------- shelf items ---------------------------- */

function useLongPress(cb: () => void) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    fired,
    handlers: {
      onPointerDown: () => {
        fired.current = false;
        clear();
        timer.current = window.setTimeout(() => {
          fired.current = true;
          navigator.vibrate?.(8);
          cb();
        }, 480);
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        clear();
        fired.current = true;
        cb();
      },
    },
  };
}

function ProgressLine({ book }: { book: ShelfBook }) {
  if (book.status === "concluido") {
    return book.rating ? (
      <span className="flex items-center gap-0.5 text-gold" aria-label={`${book.rating} estrelas`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-[13px] w-[13px] ${i < book.rating! ? "fill-current" : "text-border"}`}
            strokeWidth={2}
          />
        ))}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[12px] font-semibold text-[#1f6b46]">
        <Check className="h-3 w-3" strokeWidth={3} /> Lido
      </span>
    );
  }
  if (book.progress <= 0.005) {
    return (
      <span className="rounded-full bg-surface-2 px-3 py-1 text-[13px] font-semibold text-muted-foreground">
        Novo
      </span>
    );
  }
  const pct = Math.round(book.progress * 100);
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-accent-soft">
        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      <span className="num text-[13.5px] font-semibold">{pct}%</span>
    </div>
  );
}

function GridItem({
  book,
  index,
  onOpen,
  onMore,
}: {
  book: ShelfBook;
  index: number;
  onOpen: () => void;
  onMore: () => void;
}) {
  const { fired, handlers } = useLongPress(onMore);
  return (
    <motion.li
      // Reflow animation only for the cards on screen: measuring every
      // card of a big library on each change was a visible hitch.
      layout={index < 24}
      initial={{ opacity: 0.55, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 12) * 0.025 } }}
      exit={{ opacity: 0, scale: 0.94 }}
      className="group relative list-none"
    >
      <button
        type="button"
        {...handlers}
        onClick={(e) => {
          if (fired.current) return;
          if (book.readerId) playBookOpen(coverIn(e.currentTarget));
          onOpen();
        }}
        className="press block w-full select-none text-left [-webkit-touch-callout:none]"
        aria-label={`${book.title}, ${book.author}`}
      >
        <span className="relative block">
          <BookArt title={book.title} author={book.author} cover={book.cover} live />
          <FormatTag book={book} />
        </span>
      </button>
      <button
        type="button"
        onClick={onMore}
        aria-label={`Opções de ${book.title}`}
        className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:hidden"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <div className="mt-2.5 min-h-[26px]">
        <ProgressLine book={book} />
      </div>
    </motion.li>
  );
}

/** EPUB · PDF · Online… so every book says what it is. */
function FormatTag({ book, inline = false }: { book: ShelfBook; inline?: boolean }) {
  const f = bookFormat(book);
  const text = f.label === "ONLINE" ? "Online" : f.label === "SALVO" ? "Lista" : f.label;
  return (
    <span
      title={`${f.label} · ${f.origin}`}
      className={
        inline
          ? "shrink-0 rounded-[4px] px-1.5 py-px text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-white"
          : "shelf-label"
      }
      style={{ "--tone": f.tone, background: inline ? f.tone : undefined } as React.CSSProperties}
    >
      {text}
    </span>
  );
}

function RowItem({
  book,
  last,
  onOpen,
  onMore,
}: {
  book: ShelfBook;
  last: boolean;
  onOpen: () => void;
  onMore: () => void;
}) {
  return (
    <li className={`flex items-center gap-3 py-3 ${last ? "" : "border-b border-border"}`}>
      <button
        type="button"
        onClick={onOpen}
        className="press flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="w-[46px] shrink-0">
          <BookArt title={book.title} author={book.author} cover={book.cover} showText={false} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{book.title}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <FormatTag book={book} inline />
            <span className="truncate">{book.author}</span>
          </p>
          <div className="mt-2 max-w-[220px]">
            <ProgressLine book={book} />
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onMore}
        aria-label={`Opções de ${book.title}`}
        className="press grid h-9 w-9 shrink-0 place-items-center rounded-full text-faint"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
    </li>
  );
}

/* --------------------------------- lists -------------------------------- */

function ListsView({
  books,
  inList,
  onOpen,
}: {
  books: ShelfBook[];
  inList: (b: ShelfBook, l: ListId) => boolean;
  onOpen: (l: ListId) => void;
}) {
  return (
    <ul className="mt-5 grid grid-cols-1 gap-2.5 px-4 sm:grid-cols-2">
      {LISTS.map((l, i) => {
        const items = books.filter((b) => inList(b, l.id));
        const Icon = l.icon;
        return (
          <motion.li
            key={l.id}
            initial={{ opacity: 0.55, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
            className="list-none"
          >
            <button
              type="button"
              onClick={() => onOpen(l.id)}
              className="surface-card press flex w-full items-center gap-3.5 rounded-[22px] p-3.5 text-left"
            >
              <span
                className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[16px] text-[#131313]"
                style={{ background: l.tint }}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15.5px] font-semibold">{l.label}</p>
                <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{l.hint}</p>
              </div>
              <div className="flex shrink-0 items-center">
                {items.slice(0, 3).map((b, k) => (
                  <div
                    key={b.id}
                    className="w-[26px]"
                    style={{ marginLeft: k ? -10 : 0, transform: `rotate(${(k - 1) * 6}deg)` }}
                  >
                    <BookArt title={b.title} author={b.author} cover={b.cover} showText={false} />
                  </div>
                ))}
                <span className="num ml-2.5 min-w-[18px] text-right text-[14px] font-semibold text-faint">
                  {items.length}
                </span>
              </div>
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}

/* ------------------------------ empty states ---------------------------- */

function EmptyShelf({
  tab,
  list,
  query,
  total,
}: {
  tab: Tab;
  list: ListId | null;
  query: string;
  total: number;
}) {
  const q = query.trim();
  // M5 · "Estado vazio": nothing on the shelf at all yet.
  if (!q && !list && total === 0) {
    return (
      <div className="flex flex-col items-center px-6 pb-6 pt-6 text-center">
        <Lumi pose="reading" size={200} bob />
        <p className="mt-2 font-display text-[30px] leading-[1.02] tracking-[-0.03em]">
          Sua estante está esperando
        </p>
        <p className="mt-2.5 max-w-[300px] text-[15.5px] leading-relaxed text-muted-foreground">
          Salve um livro ou importe seus EPUBs e PDFs. A Lumi guarda tudo aqui.
        </p>
        <div className="mt-6 w-full max-w-sm space-y-2.5">
          <Link
            to="/descobrir"
            search={{}}
            className="press flex h-[54px] items-center justify-center gap-2 rounded-full bg-foreground text-[16px] font-semibold text-background"
          >
            <Compass className="h-5 w-5" /> Explorar livros grátis
          </Link>
          <Link
            to="/adicionar"
            search={{}}
            className="press flex h-[54px] items-center justify-center gap-2 rounded-full bg-card text-[16px] font-semibold shadow-[inset_0_0_0_1.5px_var(--border)]"
          >
            <FileUp className="h-5 w-5" /> Importar arquivo
          </Link>
        </div>
      </div>
    );
  }
  const copy = q
    ? {
        pose: "thinking" as const,
        title: "Nada com esse nome aqui",
        body: `Procure “${q}” no catálogo grátis.`,
      }
    : list
      ? {
          pose: "idle" as const,
          title: "Lista vazia por enquanto",
          body: "Ela se enche sozinha conforme você lê.",
        }
      : tab === "lendo"
        ? {
            pose: "reading" as const,
            title: "Nenhum livro aberto",
            body: "Escolha um clássico grátis e comece hoje.",
          }
        : tab === "quero-ler"
          ? {
              pose: "hello" as const,
              title: "Sua fila está vazia",
              body: "Salve livros para ler depois enquanto explora.",
            }
          : {
              pose: "celebrating" as const,
              title: "Os lidos aparecem aqui",
              body: "Termine um livro e ele ganha um lugar nesta estante.",
            };
  return (
    <div className="flex flex-col items-center px-8 pb-6 pt-8 text-center">
      <Lumi pose={copy.pose} size={128} bob />
      <p className="mt-3 font-display text-[22px] leading-tight">{copy.title}</p>
      <p className="mt-1.5 max-w-[260px] text-[14px] text-muted-foreground">{copy.body}</p>
      <div className="mt-5 flex gap-2">
        <Link
          to="/descobrir"
          search={q ? { q } : {}}
          className="press inline-flex h-11 items-center rounded-full bg-foreground px-5 text-[14px] font-semibold text-background"
        >
          Explorar grátis
        </Link>
        {!q && (
          <Link
            to="/adicionar"
            search={{}}
            className="press inline-flex h-11 items-center rounded-full bg-surface-2 px-5 text-[14px] font-semibold"
          >
            Importar
          </Link>
        )}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-7 px-[22px] sm:grid-cols-4 lg:grid-cols-6 lg:px-4">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] animate-pulse rounded-[4px_8px_8px_4px] bg-surface-2" />
          <div className="mt-3 h-[5px] w-3/4 animate-pulse rounded-full bg-surface-2" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- book sheet ----------------------------- */

const SHEET_STATUSES: LibraryStatus[] = [
  "lendo",
  "quero-ler",
  "concluido",
  "relendo",
  "abandonado",
];

function BookSheet({
  book,
  uid,
  onOpen,
  onClose,
}: {
  book: ShelfBook;
  uid: string | null;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState(book.status);
  const [fav, setFav] = useState(!!book.favorite);
  const [stars, setStars] = useState(book.rating ?? 0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(fn: () => Promise<void>, fail: string) {
    try {
      await fn();
    } catch (err) {
      toast.error(describeFirestoreError(err, fail));
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const rid = book.readerId;
      if (uid && book.entry) {
        if (rid && isEpubReaderId(rid)) {
          await deleteEpubBookFromCloud(uid, rid);
          await deleteEpubBook(rid).catch(() => {});
        } else if (rid && isPdfReaderId(rid)) {
          await deletePdfBookFromCloud(uid, rid);
          await deletePdfBook(rid).catch(() => {});
        }
        await removeFromLibrary(uid, book.entry.id);
      } else if (rid) {
        if (isPdfReaderId(rid)) await deletePdfBook(rid);
        else await deleteEpubBook(rid);
      }
      if (rid) {
        forgetDeviceBook(rid);
        forgetDownloadedReaderId(rid);
      }
      toast.success("Livro removido.");
      onClose();
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível remover este livro."));
      setBusy(false);
    }
  }

  const member = !!uid && !!book.entry;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center lg:items-center">
      <motion.button
        type="button"
        aria-label="Fechar"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <motion.div
        role="dialog"
        aria-label={book.title}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, i) => (i.offset.y > 90 || i.velocity.y > 600) && onClose()}
        className="relative w-full max-w-lg rounded-t-[30px] bg-card px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl lg:rounded-[30px]"
      >
        <div className="mx-auto h-[5px] w-10 rounded-full bg-border lg:hidden" />
        <div className="mt-4 flex items-center gap-3.5">
          <div className="w-[62px] shrink-0">
            <BookArt title={book.title} author={book.author} cover={book.cover} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-display text-[21px] leading-tight">{book.title}</p>
            <p className="mt-1 truncate text-[13px] text-muted-foreground">{book.author}</p>
            {book.progress > 0 && book.status !== "concluido" && (
              <p className="num mt-1 text-[12.5px] font-semibold text-gold">
                {Math.round(book.progress * 100)}% lido
              </p>
            )}
          </div>
          {member && (
            <button
              type="button"
              aria-pressed={fav}
              aria-label={fav ? "Tirar dos favoritos" : "Favoritar"}
              onClick={() => {
                setFav(!fav);
                void run(
                  () => setFavorite(uid!, book.entry!.id, !fav),
                  "Não foi possível favoritar.",
                );
              }}
              className={`press grid h-11 w-11 shrink-0 place-items-center rounded-full ${fav ? "bg-rose text-[#c0264f]" : "bg-surface-2"}`}
            >
              <Heart className={`h-5 w-5 ${fav ? "fill-current" : ""}`} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="press mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background"
        >
          <BookOpen className="h-[18px] w-[18px]" />
          {book.readerId ? (book.progress > 0 ? "Continuar lendo" : "Ler agora") : "Ver detalhes"}
        </button>

        {member && (
          <>
            <p className="eyebrow mt-5">Estante</p>
            <div className="no-scrollbar -mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5">
              {SHEET_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  data-on={status === s}
                  onClick={() => {
                    setStatus(s);
                    void run(
                      () => setLibraryStatus(uid!, book.entry!.id, s),
                      "Não foi possível mudar a estante.",
                    );
                  }}
                  className="chip shrink-0"
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <p className="eyebrow mt-5">Sua nota</p>
            <div className="mt-1.5 flex gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${i + 1} estrela${i ? "s" : ""}`}
                  onClick={() => {
                    const v = stars === i + 1 ? 0 : i + 1;
                    setStars(v);
                    void run(
                      () => setRating(uid!, book.entry!.id, v),
                      "Não foi possível salvar a nota.",
                    );
                  }}
                  className="press grid h-10 w-10 place-items-center text-gold"
                >
                  <Star
                    className={`h-7 w-7 ${i < stars ? "fill-current" : "text-border"}`}
                    strokeWidth={1.8}
                  />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 border-t border-border pt-3">
          {confirm ? (
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                {!member
                  ? "O livro será apagado deste aparelho."
                  : isPersonalFile(book.readerId)
                    ? "O arquivo será apagado da sua conta e deste aparelho."
                    : "Tirar este livro da biblioteca?"}
              </p>
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="h-10 rounded-full px-3 text-[13.5px] font-semibold text-muted-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className="press h-10 rounded-full bg-destructive px-4 text-[13.5px] font-semibold text-white disabled:opacity-60"
              >
                Remover
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="flex h-10 items-center gap-2 text-[14px] font-semibold text-destructive"
            >
              <Trash2 className="h-[17px] w-[17px]" />
              {member ? "Remover da biblioteca" : "Remover deste aparelho"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
