import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Feather,
  Heart,
  Landmark,
  Loader2,
  Map as MapIcon,
  Mic,
  Moon,
  Search,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { BookArt } from "@/components/book-art";
import { SOURCE_BADGE, SourceBadge } from "@/components/catalog/source-badge";
import { Lumi, LumiFace } from "@/components/brand/lumi";
import { formatMinutes } from "@/components/home/home-screen";
import {
  SOURCE_LABEL,
  downloadBook,
  downloadedReaderId,
  searchCatalogLive,
  useDownloads,
  type CatalogBook,
  type CatalogSource,
} from "@/lib/catalog";
import { COLLECTIONS, collectionById, type Collection } from "@/lib/collections";
import { picksFor } from "@/lib/editorial";
import { coverIn, flyToLibrary, playBookOpen } from "@/lib/book-motion";
import { LumiAskBar } from "@/components/lumi-ask-bar";
import { LangTag } from "@/components/lang-tag";
import { slugFor } from "@/lib/library";
import { gutenbergReaderId } from "@/lib/public-domain";

const SOURCES: CatalogSource[] = ["gutenberg", "wikisource", "standard", "archive"];

export const Route = createFileRoute("/descobrir")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string; categoria?: string; fonte?: CatalogSource } => ({
    q: typeof search.q === "string" ? search.q : undefined,
    categoria: typeof search.categoria === "string" ? search.categoria : undefined,
    fonte:
      typeof search.fonte === "string" && SOURCES.includes(search.fonte as CatalogSource)
        ? (search.fonte as CatalogSource)
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Explorar — BookVerse" },
      {
        name: "description",
        content:
          "Busque em Project Gutenberg, Wikisource, Standard Ebooks e Internet Archive ao mesmo tempo. Livros grátis e legais, para ler ou baixar.",
      },
    ],
  }),
  component: ExplorarPage,
});

const EASE = [0.16, 1, 0.3, 1] as const;
const ICONS = {
  landmark: Landmark,
  moon: Moon,
  heart: Heart,
  search: Search,
  feather: Feather,
  map: MapIcon,
  ghost: Moon,
  sparkles: Feather,
};

/** Source badges, as in the approved catalogue screens. */

export function bookHref(b: {
  title: string;
  author: string;
  source?: CatalogSource;
  id?: string;
  cover?: string | null;
}) {
  return {
    to: "/livro/$slug" as const,
    params: { slug: slugFor(b.title, b.author) || "livro" },
    search: {
      title: b.title,
      author: b.author,
      ...(b.source && b.id ? { source: b.source, id: b.id } : {}),
      ...(b.cover ? { cover: b.cover } : {}),
    },
  };
}

function ExplorarPage() {
  const search = Route.useSearch();
  const collection = collectionById(search.categoria);
  if (collection) return <CollectionView collection={collection} />;
  if (search.q || search.fonte) return <SearchView initial={search.q ?? ""} fonte={search.fonte} />;
  return <ExploreHome />;
}

/* ============================== Explorar ============================== */

function SearchField({
  value,
  onChange,
  autoFocus,
  onSubmit,
  placeholder = "Livros, autores, temas…",
  focused,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  onSubmit?: () => void;
  placeholder?: string;
  focused?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);
  // Voice search where the browser has it — checked after mount so the
  // server and client render the same markup.
  const [Rec, setRec] = useState<(new () => SpeechRec) | undefined>(undefined);
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (C) setRec(() => C);
  }, []);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
        ref.current?.blur();
      }}
      className={`flex h-[52px] items-center gap-2.5 rounded-[18px] bg-card px-4 transition-shadow ${
        focused
          ? "shadow-[inset_0_0_0_2px_var(--parchment)]"
          : "shadow-[inset_0_0_0_1px_var(--border)]"
      }`}
    >
      <Search className="h-5 w-5 shrink-0 text-faint" strokeWidth={2} />
      <input
        ref={ref}
        type="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Buscar livros"
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Limpar"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          className="grid h-[22px] w-[22px] place-items-center rounded-full bg-secondary"
        >
          <X className="h-3 w-3" strokeWidth={2.6} />
        </button>
      ) : Rec ? (
        <button
          type="button"
          aria-label="Buscar por voz"
          onClick={() => {
            const r = new Rec();
            r.lang = "pt-BR";
            r.interimResults = false;
            r.onresult = (ev) => {
              const text = ev.results[0]?.[0]?.transcript ?? "";
              if (text) onChange(text);
              onSubmit?.();
            };
            r.onend = () => setListening(false);
            setListening(true);
            r.start();
          }}
          className={`grid h-8 w-8 place-items-center rounded-full ${listening ? "bg-accent-soft text-gold" : "text-faint"}`}
        >
          <Mic className="h-5 w-5" strokeWidth={2} />
        </button>
      ) : null}
    </form>
  );
}

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  onresult: (ev: { results: { 0?: { transcript: string } }[] }) => void;
  onend: () => void;
  start: () => void;
}

function Fan({ books, w = 70 }: { books: { title: string; author: string }[]; w?: number }) {
  return (
    <div className="relative h-full w-full">
      {books.slice(0, 3).map((b, i) => (
        <div
          key={b.title}
          className="absolute"
          style={{
            left: i * (w * 0.54),
            bottom: -8 - (i % 2) * 6,
            transform: `rotate(${(i - 1) * 7}deg)`,
            zIndex: 3 - Math.abs(i - 1),
            width: w,
          }}
        >
          <BookArt title={b.title} author={b.author} />
        </div>
      ))}
    </div>
  );
}

function ExploreHome() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [q, setQ] = useState("");
  const rise = (d = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0.55, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, ease: EASE, delay: d },
        };
  const [big, half1, half2, ...more] = COLLECTIONS;
  const chips: { label: string; to?: string }[] = [
    { label: "Tudo" },
    { label: "Clássicos BR", to: "classicos-brasileiros" },
    { label: "Até 2h", to: "uma-noite" },
    { label: "Romance", to: "romances" },
    { label: "Mistério", to: "misterio" },
    { label: "Poesia", to: "poesia" },
    { label: "Aventura", to: "aventura" },
  ];
  const trend = useMemo(() => picksFor({ count: 5, shuffle: 3 }), []);

  return (
    <div className="mx-auto max-w-5xl pb-10 pt-[calc(env(safe-area-inset-top)+0.875rem)] lg:pt-10">
      <motion.div {...rise()} className="px-[22px] lg:px-10">
        <h1 className="text-[34px] leading-none lg:text-[44px]">Explorar</h1>
        <div className="mt-4">
          <SearchField
            value={q}
            onChange={(v) => {
              setQ(v);
              if (v.trim().length >= 2)
                void navigate({ to: "/descobrir", search: { q: v }, replace: false });
            }}
          />
        </div>
      </motion.div>

      <motion.div
        {...rise(0.04)}
        className="no-scrollbar mt-3.5 flex gap-2 overflow-x-auto px-[22px] lg:px-10"
      >
        {chips.map((c, i) => (
          <button
            key={c.label}
            type="button"
            data-on={i === 0}
            onClick={() => c.to && void navigate({ to: "/descobrir", search: { categoria: c.to } })}
            className="chip shrink-0"
          >
            {c.label}
          </button>
        ))}
      </motion.div>

      <motion.div {...rise(0.06)} className="mt-4 px-4 lg:px-10">
        <LumiAskBar
          placeholder="Diga à Lumi o que você quer ler…"
          prefix="Me recomende livros de domínio público (grátis) para este pedido, com uma frase sobre cada um: "
          suggestions={[
            "Um mistério curto para hoje à noite",
            "Algo parecido com Dom Casmurro",
            "Um clássico leve para começar",
          ]}
        />
      </motion.div>

      {/* Collections bento */}
      <motion.div
        {...rise(0.08)}
        className="mt-4 grid grid-cols-2 gap-2.5 px-4 lg:gap-4 xl:grid-cols-4 lg:px-10"
      >
        <Link
          to="/descobrir"
          search={{ categoria: big!.id }}
          className="press relative col-span-2 h-[158px] overflow-hidden rounded-[28px] p-5 lg:h-[220px] lg:p-7"
          style={{ background: big!.bg }}
        >
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: big!.ink }}
          >
            Coleção
          </span>
          <p className="mt-2 max-w-[min(170px,46%)] font-display text-[clamp(22px,7vw,27px)] leading-[0.98] text-[#131313] lg:max-w-[240px] lg:text-[34px]">
            {big!.title}
          </p>
          <p className="mt-2 text-[13px]" style={{ color: big!.ink }}>
            {big!.books.length} livros · {big!.subtitle}
          </p>
          <div className="absolute right-4 top-[22px] h-[140px] w-[min(150px,40%)] lg:right-10 lg:top-8 lg:h-[180px] lg:w-[190px]">
            <Fan books={[big!.books[0]!, big!.books[2]!, big!.books[3]!]} />
          </div>
        </Link>
        {[half1!, half2!].map((c) => (
          <CollectionTile key={c.id} c={c} />
        ))}
      </motion.div>

      {/* Trending */}
      <motion.section {...rise(0.12)} className="mt-[22px] lg:mt-10">
        <div className="mb-3.5 flex items-baseline justify-between px-[22px] lg:px-10">
          <h2 className="text-[21px] lg:text-[26px]">Em alta esta semana</h2>
          <span className="text-[13.5px] font-semibold text-muted-foreground">
            Clássicos grátis
          </span>
        </div>
        <ol className="flex flex-col gap-3 px-[22px] lg:grid lg:grid-cols-2 lg:gap-x-10 lg:px-10">
          {trend.map((p, i) => (
            <li key={p.gutenbergId}>
              <Link
                {...bookHref({
                  title: p.title,
                  author: p.author,
                  source: "gutenberg",
                  id: String(p.gutenbergId),
                })}
                className="press flex items-center gap-3.5"
              >
                <span className="w-[22px] font-display text-[30px] text-faint">{i + 1}</span>
                <div className="w-[46px] shrink-0">
                  <BookArt title={p.title} author={p.author} showText={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{p.title}</p>
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                    {p.author} · {formatMinutes(p.minutes)}
                  </p>
                </div>
                <LangTag code={p.lang} />
              </Link>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* More collections */}
      <motion.section {...rise(0.16)} className="mt-8 lg:mt-12">
        <h2 className="mb-3.5 px-[22px] text-[21px] lg:px-10 lg:text-[26px]">Mais coleções</h2>
        <div className="grid grid-cols-2 gap-2.5 px-4 lg:grid-cols-3 lg:gap-4 lg:px-10">
          {more.map((c) => (
            <CollectionTile key={c.id} c={c} />
          ))}
        </div>
      </motion.section>

      {/* Free sources */}
      <motion.section {...rise(0.2)} className="mt-8 lg:mt-12">
        <div className="mb-3 flex items-baseline justify-between px-[22px] lg:px-10">
          <h2 className="text-[21px] lg:text-[26px]">Catálogos grátis</h2>
          <span className="text-[12.5px] font-semibold text-muted-foreground">Download direto</span>
        </div>
        <div className="grid gap-2 px-4 lg:grid-cols-2 lg:gap-3 lg:px-10">
          {SOURCES.map((s) => (
            <Link
              key={s}
              to="/descobrir"
              search={{ fonte: s }}
              className="surface-card press flex items-center gap-3 rounded-[18px] p-3"
            >
              <SourceBadge source={s} />
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold">{SOURCE_LABEL[s]}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{SOURCE_BADGE[s].hint}</p>
              </div>
              <ChevronRight className="h-[17px] w-[17px] text-faint" />
            </Link>
          ))}
          <a
            href="http://www.dominiopublico.gov.br/pesquisa/PesquisaObraForm.jsp"
            target="_blank"
            rel="noreferrer"
            className="surface-card press flex items-center gap-3 rounded-[18px] p-3"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#1351b4] font-display text-[15px] text-white">
              DP
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold">Domínio Público</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Acervo do governo · PDF · abre o site oficial
              </p>
            </div>
            <ExternalLink className="h-[16px] w-[16px] text-faint" />
          </a>
        </div>
      </motion.section>
    </div>
  );
}

function CollectionTile({ c }: { c: Collection }) {
  const Icon = ICONS[c.icon];
  const cover = c.books[0]!;
  return (
    <Link
      to="/descobrir"
      search={{ categoria: c.id }}
      className="press relative h-[150px] overflow-hidden rounded-[26px] p-4 lg:h-[200px] lg:p-6"
      style={{ background: c.bg }}
    >
      <Icon className="h-5 w-5 text-[#131313]" strokeWidth={2} />
      <p className="mt-2.5 max-w-[120px] font-display text-[clamp(16px,5vw,19px)] leading-[1.05] text-[#131313] max-[359px]:max-w-[96px] lg:max-w-[160px] lg:text-[24px]">
        {c.title}
      </p>
      <p className="mt-1.5 text-[12.5px] text-[#5c5b56]">{c.subtitle}</p>
      <div className="absolute -bottom-6 -right-2.5 w-[58px] rotate-[10deg] max-[359px]:w-[44px] lg:w-[78px]">
        <BookArt title={cover.title} author={cover.author} />
      </div>
    </Link>
  );
}

/* ============================== Collection ============================== */

function CollectionView({ collection: c }: { collection: Collection }) {
  return (
    <div className="mx-auto max-w-5xl pb-10 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:pt-10">
      <div className="px-4 lg:px-10">
        <Link
          to="/descobrir"
          search={{}}
          aria-label="Voltar"
          className="-ml-2 grid h-[42px] w-[42px] place-items-center rounded-full"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
      </div>
      <div
        className="mx-4 mt-2 overflow-hidden rounded-[28px] p-6 lg:mx-10 lg:p-8"
        style={{ background: c.bg }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: c.ink }}
        >
          Coleção
        </p>
        <h1 className="mt-2 text-[32px] leading-none text-[#131313] lg:text-[44px]">{c.title}</h1>
        <p className="mt-2 text-sm" style={{ color: c.ink }}>
          {c.books.length} livros · {c.subtitle}
        </p>
      </div>
      <div className="mt-6 reveal-flow grid grid-cols-3 gap-x-3.5 gap-y-5 px-[22px] sm:grid-cols-4 lg:grid-cols-6 lg:gap-x-5 lg:px-10">
        {c.books.map((b) => (
          <Link key={b.title} {...bookHref(b)} className="press min-w-0">
            <BookArt title={b.title} author={b.author} live />
            <p className="mt-2 truncate text-[13px] font-semibold">{b.title}</p>
            <p className="truncate text-xs text-faint">
              {b.minutes ? formatMinutes(b.minutes) : b.author}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ============================== Search ============================== */

function SearchView({ initial, fonte }: { initial: string; fonte?: CatalogSource }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<CatalogBook[] | null>(null);
  const [pending, setPending] = useState(0);
  const [lang, setLang] = useState<"pt" | "en" | null>(null);
  const [sources, setSources] = useState<Set<CatalogSource>>(new Set(fonte ? [fonte] : []));
  const [order, setOrder] = useState<"relevancia" | "az">("relevancia");
  const downloads = useDownloads();

  // Debounced live search; the URL follows so Back works.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults(null);
      setPending(0);
      return;
    }
    let cancel = () => {};
    const t = setTimeout(() => {
      setResults(null);
      setPending(3);
      cancel = searchCatalogLive(query, (r, p) => {
        setResults(r);
        setPending(p);
      });
      void navigate({
        to: "/descobrir",
        search: { q: query, ...(fonte ? { fonte } : {}) },
        replace: true,
      });
    }, 320);
    return () => {
      clearTimeout(t);
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const shown = useMemo(() => {
    let r = results ?? [];
    if (lang) r = r.filter((b) => b.language === lang);
    if (sources.size) r = r.filter((b) => sources.has(b.source));
    if (order === "az") r = [...r].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    return r;
  }, [results, lang, sources, order]);

  // Most common author whose name matches the query → author card.
  const author = useMemo(() => {
    const terms = q
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 2);
    const counts = new Map<string, number>();
    for (const b of results ?? []) {
      const a = b.author.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (terms.length && terms.every((t) => a.includes(t)))
        counts.set(b.author, (counts.get(b.author) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 2 ? { name: best[0], count: best[1] } : null;
  }, [results, q]);

  const toggleSource = (s: CatalogSource) =>
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const downloading = [...downloads.entries()].filter(
    ([, s]) => s.state === "downloading" || s.state === "preparing",
  );

  return (
    <div className="mx-auto max-w-4xl pb-10 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:pt-10">
      {fonte && (
        <div className="flex items-center gap-2.5 px-4 pb-3 lg:px-10">
          <Link
            to="/descobrir"
            search={{}}
            aria-label="Voltar"
            className="-ml-2 grid h-[42px] w-[42px] place-items-center rounded-full"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <SourceBadge source={fonte} />
          <div>
            <p className="text-base font-bold">{SOURCE_LABEL[fonte]}</p>
            <p className="text-xs text-faint">Domínio público · grátis e legal</p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3.5 px-4 lg:px-10">
        <div className="min-w-0 flex-1">
          <SearchField
            value={q}
            onChange={setQ}
            autoFocus={!initial}
            focused
            placeholder={fonte ? `Buscar no ${SOURCE_LABEL[fonte]}…` : undefined}
          />
        </div>
        <Link to="/descobrir" search={{}} className="shrink-0 text-[15px] font-semibold">
          Cancelar
        </Link>
      </div>

      <div className="no-scrollbar mt-3.5 flex gap-2 overflow-x-auto px-4 lg:px-10">
        <span className="chip shrink-0 px-3" aria-hidden>
          <SlidersHorizontal className="h-4 w-4" />
        </span>
        <span className="chip shrink-0" data-on="true">
          <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> Grátis
        </span>
        <button
          type="button"
          className="chip shrink-0"
          data-on={lang === "pt"}
          onClick={() => setLang(lang === "pt" ? null : "pt")}
        >
          Português
        </button>
        <button
          type="button"
          className="chip shrink-0"
          data-on={lang === "en"}
          onClick={() => setLang(lang === "en" ? null : "en")}
        >
          Inglês
        </button>
        {!fonte &&
          SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              className="chip shrink-0"
              data-on={sources.has(s)}
              onClick={() => toggleSource(s)}
            >
              {SOURCE_LABEL[s].replace("Project ", "")}
            </button>
          ))}
      </div>

      {author && !fonte && (
        <div className="surface-card mx-4 mt-4 flex items-center gap-3.5 p-3.5 lg:mx-10">
          <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#1d4a37,#3f7a5e)] font-display text-[19px] text-[#f4ebd6]">
            {author.name
              .split(" ")
              .filter((w) => w.length > 2)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Autor</p>
            <p className="mt-1 truncate text-[16.5px] font-bold">{author.name}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {author.count} obras encontradas
            </p>
          </div>
          <button
            type="button"
            onClick={() => setQ(author.name)}
            className="btn-ghost shrink-0 px-4 py-2 text-sm"
          >
            Ver obras
          </button>
        </div>
      )}

      {q.trim().length >= 2 && (
        <div className="mx-[22px] mb-2.5 mt-[22px] flex items-baseline justify-between lg:mx-10">
          <p className="font-display text-lg">
            {results === null || (pending > 0 && shown.length === 0)
              ? "Buscando nos acervos…"
              : `${shown.length} ${shown.length === 1 ? "livro" : "livros"}`}
          </p>
          <button
            type="button"
            onClick={() => setOrder(order === "relevancia" ? "az" : "relevancia")}
            className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-muted-foreground"
          >
            {order === "relevancia" ? "Mais relevantes" : "A–Z"} <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="px-4 lg:px-10">
        {results === null && q.trim().length >= 2 && (
          <>
            <LumiSearching />
            <ResultSkeleton />
          </>
        )}
        {results !== null && shown.length === 0 && pending === 0 && <NoResults q={q} />}
        <ul>
          {shown.map((b, i) => (
            <ResultRow key={b.key} book={b} q={q} last={i === shown.length - 1} />
          ))}
        </ul>
        {results !== null && pending > 0 && shown.length === 0 && <LumiSearching />}
        {results !== null && pending > 0 && shown.length > 0 && (
          <p className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-faint">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando mais acervos…
          </p>
        )}
        {q.trim().length < 2 && !fonte && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Digite o nome de um livro ou autor.
          </p>
        )}
      </div>

      {downloading.length > 0 && (
        <div className="fixed inset-x-3 bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+6rem))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-[22px] bg-foreground px-3.5 py-3 text-background shadow-xl lg:bottom-6 lg:left-[calc(264px+1.5rem)]">
          <LumiFace size={38} bg="#2a2a30" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              Baixando {downloading.length} {downloading.length === 1 ? "livro" : "livros"}
            </p>
            <p className="mt-0.5 text-xs opacity-65">Fica disponível offline</p>
          </div>
          <Link to="/downloads" className="px-1 text-[13px] font-semibold text-[#ff8a5b]">
            Ver
          </Link>
        </div>
      )}
    </div>
  );
}

function highlight(text: string, q: string) {
  const terms = q
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.join("|")})`, "ig");
  return text.split(re).map((part, i) =>
    re.test(part) && i % 2 === 1 ? (
      <mark key={i} className="rounded-[3px] bg-butter px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function ResultRow({ book: b, q, last }: { book: CatalogBook; q: string; last: boolean }) {
  const navigate = useNavigate();
  const downloads = useDownloads();
  const state = downloads.get(b.key);
  const local = state?.state === "done" ? state.readerId : downloadedReaderId(b.key);
  const ready = local ?? b.readerId ?? null;

  async function act(row: Element | null) {
    if (ready) {
      playBookOpen(coverIn(row));
      void navigate({ to: "/reader/$bookId", params: { bookId: ready } });
      return;
    }
    try {
      const id = await downloadBook(b);
      flyToLibrary(row);
      toast.success(`"${b.title}" baixado — disponível offline.`, {
        action: {
          label: "Ler",
          onClick: () => void navigate({ to: "/reader/$bookId", params: { bookId: id } }),
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível baixar agora.");
    }
  }

  return (
    <li
      className={`flex items-center gap-3.5 px-1.5 py-2.5 ${last ? "" : "border-b border-border"}`}
    >
      <Link {...bookHref(b)} className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="w-[54px] shrink-0">
          <BookArt title={b.title} author={b.author} cover={b.cover} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-semibold">{b.title}</p>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {highlight(b.author, q)}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-faint">
            <span className="truncate">{SOURCE_LABEL[b.source]}</span>
            <LangTag code={b.language} />
            <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-bold text-[#1f6b46]">
              Grátis
            </span>
          </div>
        </div>
      </Link>
      {state?.state === "downloading" || state?.state === "preparing" ? (
        <span className="relative grid h-9 w-9 shrink-0 place-items-center" aria-label="Baixando">
          <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth="3.5"
            />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="var(--gold)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${94.2 * (state.state === "downloading" ? state.progress : 1)} 94.2`}
            />
          </svg>
          <Square className="absolute h-2.5 w-2.5" fill="currentColor" />
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => void act(e.currentTarget.closest("li"))}
          className="press inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background"
        >
          {ready ? (
            "Ler"
          ) : (
            <>
              <Download className="h-[15px] w-[15px]" strokeWidth={2.4} /> Baixar
            </>
          )}
        </button>
      )}
    </li>
  );
}

/** M4 · "Lumi está procurando…" while the catalogues answer. */
function LumiSearching() {
  return (
    <div className="mb-2 flex items-center gap-4 rounded-[24px] bg-card px-4 py-3 shadow-[inset_0_0_0_1px_var(--border)]">
      <Lumi pose="thinking" size={64} bob />
      <div className="min-w-0 flex-1">
        <p className="eyebrow">Carregando</p>
        <p className="mt-1 text-[15.5px] font-bold">Lumi está procurando…</p>
        <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-accent-soft">
          <div className="h-full w-1/3 animate-[lumi-search_1.2s_ease-in-out_infinite] rounded-full bg-gold" />
        </div>
      </div>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <ul aria-busy="true">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex items-center gap-3.5 border-b border-border px-1.5 py-2.5">
          <div className="aspect-[2/3] w-[54px] animate-pulse rounded-[4px_8px_8px_4px] bg-secondary" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-secondary" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-secondary" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function NoResults({ q }: { q: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <Lumi pose="oops" size={150} />
      <p className="font-display text-2xl">Nada por aqui</p>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Não encontramos “{q}” nos acervos grátis. Tente o nome do autor ou outra grafia — livros
        recentes não são de domínio público.
      </p>
    </div>
  );
}
