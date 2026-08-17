import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookMarked,
  BookOpenCheck,
  Bookmark,
  Flame,
  Sparkles,
  Trophy,
  Clock3,
  Play,
} from "lucide-react";

import heroImg from "@/assets/hero-library.webp";
import { LumiMascot } from "@/components/lumi-mascot";
import { SAMPLE_BOOKS } from "@/lib/sample-book";
import { Carousel } from "@/components/carousel";
import { LanguageBadge } from "@/components/language-badge";
import { LumiButton } from "@/components/lumi-panel";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { subscribeRanking, type RankingRow } from "@/lib/ranking";
import { subscribeUserProfile } from "@/lib/user-profile";
import { maybeShowReadingReminder } from "@/lib/reading-reminder";
import { subscribeLibrary, slugFor, type LibraryEntry } from "@/lib/library";
import { subscribeAuth } from "@/lib/firebase";
import {
  searchPublicDomainBooks,
  gutenbergReaderId,
  type PublicDomainSummary,
} from "@/lib/public-domain";
import { trendingBooks, booksBySubject, type OpenLibraryBook } from "@/lib/open-library";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BookVerse — Sua biblioteca literária premium" },
      {
        name: "description",
        content:
          "Leitor imersivo, progresso sincronizado, IA literária e recomendações inteligentes. Uma experiência editorial de leitura.",
      },
    ],
  }),
  component: Home,
});

const CATEGORIES = [
  "Ficção literária",
  "Clássicos",
  "Ficção científica",
  "Poesia",
  "Ensaios",
  "Filosofia",
  "Biografias",
  "Romance",
  "Mistério",
];

function Home() {
  const [homeUser, setHomeUser] = useState<User | null>(null);
  const [challengeStats, setChallengeStats] = useState({
    booksCompleted: 0,
    libraryCount: 0,
    xp: 0,
  });
  const [publicDomainPicks, setPublicDomainPicks] = useState<PublicDomainSummary[]>([]);
  const [bestsellers, setBestsellers] = useState<OpenLibraryBook[]>([]);
  const [subjectBestsellers, setSubjectBestsellers] = useState<OpenLibraryBook[]>([]);
  const [continueReading, setContinueReading] = useState<LibraryEntry[]>([]);
  // A different genre each time the homepage loads — one of the four
  // fully-readable sample stories, so "Leitura em destaque" isn't always
  // the same book. Starts on the first one (stable for SSR) and only
  // randomizes after mount — picking randomly during the initial render
  // would make the server and the client disagree on what to render,
  // which React flags as a hydration mismatch.
  const [featuredSample, setFeaturedSample] = useState(SAMPLE_BOOKS[0]);
  useEffect(() => {
    setFeaturedSample(SAMPLE_BOOKS[Math.floor(Math.random() * SAMPLE_BOOKS.length)]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    searchPublicDomainBooks("Machado de Assis", 6)
      .then((r) => {
        if (!cancelled) setPublicDomainPicks(r);
      })
      .catch(() => {});
    trendingBooks("weekly", 10, {
      onUpdate: (r) => {
        if (!cancelled) setBestsellers(r);
      },
    })
      .then((r) => {
        if (!cancelled) setBestsellers(r);
      })
      .catch(() => {});
    booksBySubject("bestsellers", 10, {
      onUpdate: (r) => {
        if (!cancelled) setSubjectBestsellers(r);
      },
    })
      .then((r) => {
        if (!cancelled) setSubjectBestsellers(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeAuth(setHomeUser), []);
  useEffect(() => {
    if (!homeUser || homeUser.isAnonymous) {
      setChallengeStats({ booksCompleted: 0, libraryCount: 0, xp: 0 });
      setContinueReading([]);
      return;
    }
    const unsubProfile = subscribeUserProfile(homeUser.uid, (p) =>
      setChallengeStats((s) => ({ ...s, booksCompleted: p?.booksCompleted ?? 0, xp: p?.xp ?? 0 })),
    );
    const unsubLibrary = subscribeLibrary(homeUser.uid, (entries) => {
      setChallengeStats((s) => ({ ...s, libraryCount: entries.length }));
      setContinueReading(entries.filter((e) => e.status === "lendo").slice(0, 3));
    });
    return () => {
      unsubProfile();
      unsubLibrary();
    };
  }, [homeUser]);

  useEffect(() => {
    if (!homeUser || homeUser.isAnonymous) return;
    const unsub = subscribeUserProfile(homeUser.uid, (p) => {
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      maybeShowReadingReminder(p?.lastActiveDate === todayKey);
    });
    return unsub;
  }, [homeUser]);

  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <img
            src={heroImg}
            alt=""
            width={1920}
            height={1280}
            fetchPriority="high"
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        </div>

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-14 px-5 pt-16 pb-24 md:px-8 lg:grid-cols-[1.15fr_1fr] lg:pt-24 lg:pb-32">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1.5 text-xs font-medium text-gold-soft">
              <Sparkles className="h-3.5 w-3.5" />
              Nova experiência de leitura
            </div>

            <h1 className="mt-6 font-display text-5xl font-medium leading-[1.02] tracking-tight md:text-6xl lg:text-7xl">
              Toda biblioteca <br />
              merece um <span className="text-gradient-gold italic">santuário</span>.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              Descubra, leia e organize seus livros em uma experiência editorial premium.
              Sincronizado, imersivo e cuidadosamente desenhado para leitores exigentes.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/reader/$bookId"
                params={{ bookId: featuredSample.id }}
                className="group inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Começar a ler
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/reader/$bookId"
                params={{ bookId: featuredSample.id }}
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3.5 text-sm font-medium text-foreground/85 hover:border-gold/50 hover:text-foreground"
              >
                <Play className="h-4 w-4 text-gold" />
                Ver o leitor
              </Link>
            </div>

            <dl className="mt-14 grid max-w-md grid-cols-3 gap-6">
              {[
                { k: "2.4M", v: "leitores" },
                { k: "180k", v: "títulos" },
                { k: "4.9★", v: "avaliação" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="font-display text-2xl font-semibold text-foreground">{s.k}</dt>
                  <dd className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Lumi plate — the hero showcases the AI reading companion
              instead of any single book, so it reads as "what this app
              does for you" rather than "here's one specific title". */}
          <div className="relative flex items-center justify-center">
            <div className="glass-plate relative w-full max-w-sm rounded-3xl p-8 text-center [box-shadow:var(--shadow-plate)]">
              <div className="relative mx-auto w-fit">
                <LumiMascot size={140} interactive onClick={() => openLumiPanel(null)} />
                <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-gold/15 blur-3xl" />
              </div>
              <p className="mt-5 text-[11px] uppercase tracking-[0.25em] text-gold">
                Sua companhia de leitura
              </p>
              <h3 className="mt-2 font-display text-xl font-semibold">Converse com a Lumi</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Resumos, recomendações parecidas com o que você já leu, e respostas pra qualquer
                dúvida sobre o capítulo — direto enquanto você lê.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {["Resumir capítulo", "Livros parecidos", "Tirar dúvidas"].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <button
                onClick={() => openLumiPanel(null)}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Conversar com a Lumi
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Real, live #1 from this week's actual trending list (Open
                Library) — kept as a small honest real-data badge beside
                the Lumi card. */}
            {bestsellers[0] && (
              <Link
                to="/livro/$slug"
                params={{ slug: slugFor(bestsellers[0].title, bestsellers[0].author) || "livro" }}
                search={{ title: bestsellers[0].title, author: bestsellers[0].author }}
                className="group absolute -top-4 right-4 flex w-52 items-center gap-3 rounded-2xl border border-border/60 bg-card/90 p-3 shadow-lg backdrop-blur transition hover:border-gold/40 md:-right-6"
              >
                {bestsellers[0].cover ? (
                  <img
                    src={bestsellers[0].cover}
                    alt=""
                    className="h-14 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="grid h-14 w-10 shrink-0 place-items-center rounded bg-secondary" />
                )}
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-gold">
                    <Flame className="h-3 w-3" /> Nº1 em alta agora
                  </p>
                  <p className="mt-1 truncate text-xs font-medium text-foreground">
                    {bestsellers[0].title}
                  </p>
                </div>
              </Link>
            )}

            <LumiMascot size={128} className="absolute -bottom-6 -left-4 hidden md:block" />
          </div>
        </div>

        <div className="hairline mx-auto max-w-7xl" />
      </section>

      {/* CONTINUE READING — real data from the signed-in user's library */}
      <Section
        eyebrow="Continue lendo"
        title="Retome de onde parou"
        action="Ver tudo"
        actionTo="/biblioteca"
      >
        {continueReading.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {continueReading.map((entry) => (
              <ContinueCard key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
            <p className="text-muted-foreground">
              {homeUser && !homeUser.isAnonymous
                ? "Você ainda não começou nenhuma leitura. Que tal escolher o próximo livro?"
                : "Entre na sua conta para ver aqui os livros que você está lendo agora."}
            </p>
            <Link
              to={homeUser && !homeUser.isAnonymous ? "/descobrir" : "/auth"}
              search={
                homeUser && !homeUser.isAnonymous
                  ? { q: undefined, categoria: undefined }
                  : { redirect: "/descobrir" }
              }
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              {homeUser && !homeUser.isAnonymous ? "Descobrir livros" : "Entrar"}
            </Link>
          </div>
        )}
      </Section>

      {/* TRENDING RAIL — real Open Library weekly trending */}
      {bestsellers.length > 0 && (
        <Section
          eyebrow="Em alta"
          title="O que a comunidade está lendo"
          action="Descobrir"
          actionTo="/descobrir"
          icon={<Flame className="h-4 w-4" />}
        >
          <Carousel>
            {bestsellers.map((book, i) => (
              <OpenLibraryBookCard key={book.workKey + i} book={book} rank={i + 1} />
            ))}
          </Carousel>
        </Section>
      )}

      {/* BESTSELLERS — Open Library "bestsellers" subject shelf */}
      {subjectBestsellers.length > 0 && (
        <Section
          eyebrow="Bestsellers"
          title="O que está bombando esta semana"
          action="Ver catálogo"
          actionTo="/catalogo"
          icon={<Sparkles className="h-4 w-4" />}
        >
          <Carousel>
            {subjectBestsellers.map((book, i) => (
              <Link
                key={book.workKey + i}
                to="/catalogo"
                className="group w-40 shrink-0 snap-start sm:w-44"
              >
                {book.cover ? (
                  <img
                    src={book.cover}
                    alt={book.title}
                    loading="lazy"
                    className="book-shadow aspect-[2/3] w-full rounded-md object-cover transition-transform duration-500 group-hover:-translate-y-1"
                  />
                ) : (
                  <div className="book-shadow grid aspect-[2/3] w-full place-items-center rounded-md bg-secondary p-3 text-center">
                    <span className="font-display text-xs text-foreground/70">{book.title}</span>
                  </div>
                )}
                <p className="mt-4 truncate font-display text-[15px] font-medium">{book.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author}</p>
              </Link>
            ))}
          </Carousel>
        </Section>
      )}

      {/* PUBLIC DOMAIN — real, full text, read now */}
      {publicDomainPicks.length > 0 && (
        <Section
          eyebrow="Domínio público"
          title="Leia agora, texto completo e gratuito"
          action="Ver mais"
          actionTo="/descobrir"
          actionSearch={{ categoria: "Clássicos" }}
          icon={<BookOpenCheck className="h-4 w-4" />}
        >
          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {publicDomainPicks.map((book) => (
              <Link
                key={book.id}
                to="/reader/$bookId"
                params={{ bookId: gutenbergReaderId(book.id) }}
                className="group"
              >
                <div className="relative">
                  {book.cover ? (
                    <img
                      src={book.cover}
                      alt={book.title}
                      loading="lazy"
                      className="book-shadow aspect-[2/3] w-full rounded-md object-cover transition-transform group-hover:-translate-y-1"
                    />
                  ) : (
                    <div className="book-shadow grid aspect-[2/3] w-full place-items-center rounded-md bg-secondary p-3 text-center">
                      <span className="font-display text-xs text-foreground/70">{book.title}</span>
                    </div>
                  )}
                  <LanguageBadge languages={book.languages} />
                </div>
                <p className="mt-2.5 truncate font-display text-sm font-medium">{book.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author}</p>
                <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-gold">
                  <BookOpenCheck className="h-3 w-3" /> Ler agora
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* CATEGORIES */}
      <Section eyebrow="Explorar" title="Por categoria">
        <div className="flex flex-wrap gap-2.5">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              to="/descobrir"
              search={{ categoria: c, q: undefined }}
              className="rounded-full border border-border bg-secondary/40 px-4 py-2 text-sm text-foreground/85 transition hover:border-gold/40 hover:text-gold"
            >
              {c}
            </Link>
          ))}
        </div>
      </Section>

      {/* SPLIT: RANKING + AI */}
      <section className="content-auto mx-auto max-w-7xl px-5 py-10 md:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <RankingCard />
          <AICard />
        </div>
      </section>

      {/* CHALLENGES */}
      <Section
        eyebrow="Desafios"
        title="Metas que valem uma medalha"
        action="Ver desafios"
        actionTo="/desafios"
        icon={<Trophy className="h-4 w-4" />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <ChallengeCard
            title="12 livros em 2026"
            progress={Math.min(100, Math.round((challengeStats.booksCompleted / 12) * 100))}
            pill="Anual"
          />
          <ChallengeCard
            title="Monte sua estante"
            progress={Math.min(100, Math.round((challengeStats.libraryCount / 5) * 100))}
            pill="Biblioteca"
          />
          <ChallengeCard
            title="1000 XP"
            progress={Math.min(100, Math.round((challengeStats.xp / 1000) * 100))}
            pill="Streak"
          />
        </div>
      </Section>

      {/* CTA */}
      <section className="content-auto mx-auto max-w-7xl px-5 pb-24 md:px-8">
        <div className="glass-plate relative overflow-hidden rounded-3xl px-8 py-14 md:px-14">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-gold">Bookverse Premium</p>
              <h2 className="mt-3 font-display text-4xl font-medium leading-tight md:text-5xl">
                Sua biblioteca, elegante em qualquer dispositivo.
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground">
                Sincronização em todos os aparelhos, leitor personalizável, IA literária e progresso
                salvo automaticamente.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/auth"
                  search={{ redirect: undefined }}
                  className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-medium text-primary-foreground"
                >
                  Começar grátis <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/sobre"
                  className="inline-flex items-center rounded-full border border-border px-6 py-3.5 text-sm font-medium"
                >
                  Saiba mais
                </Link>
              </div>
            </div>
            <LumiMascot size={208} className="mx-auto" />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function Section({
  eyebrow,
  title,
  action,
  actionTo,
  actionSearch,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  actionTo?: "/descobrir" | "/biblioteca" | "/desafios" | "/catalogo";
  actionSearch?: Record<string, string>;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="content-auto mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14">
      <header className="mb-7 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold">
            {icon}
            {eyebrow}
          </div>
          <h2 className="mt-2 font-display text-3xl font-medium leading-tight md:text-4xl">
            {title}
          </h2>
        </div>
        {action && actionTo && (
          <Link
            to={actionTo}
            search={actionSearch}
            className="shrink-0 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold transition"
          >
            {action} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function OpenLibraryBookCard({ book, rank }: { book: OpenLibraryBook; rank?: number }) {
  return (
    <Link
      to="/livro/$slug"
      params={{ slug: slugFor(book.title, book.author) || "livro" }}
      search={{ title: book.title, author: book.author }}
      className="group relative w-40 shrink-0 snap-start text-left sm:w-44"
    >
      <div className="relative">
        {book.cover ? (
          <img
            src={book.cover}
            alt={book.title}
            loading="lazy"
            className="book-shadow aspect-[2/3] w-full rounded-md object-cover transition-transform duration-500 group-hover:-translate-y-1"
          />
        ) : (
          <div className="book-shadow grid aspect-[2/3] w-full place-items-center rounded-md bg-secondary p-3 text-center">
            <span className="font-display text-xs text-foreground/70">{book.title}</span>
          </div>
        )}
        {rank !== undefined && (
          <span className="absolute -bottom-3 -left-2 font-display text-5xl font-semibold text-gold/90 [text-shadow:0_4px_12px_rgba(0,0,0,0.7)]">
            {rank}
          </span>
        )}
      </div>
      <div className="mt-5 min-w-0">
        <p className="truncate font-display text-[15px] font-medium">{book.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author}</p>
      </div>
    </Link>
  );
}

/** "Continue lendo" card backed by a real library entry — links straight
 * into the reader when the title has in-app full text, or to its details
 * page otherwise. */
function ContinueCard({ entry }: { entry: LibraryEntry }) {
  const inner = (
    <>
      {entry.cover ? (
        <img
          src={entry.cover}
          alt={entry.title}
          loading="lazy"
          className="book-shadow h-28 w-20 rounded-md object-cover"
        />
      ) : (
        <div className="book-shadow grid h-28 w-20 place-items-center rounded-md bg-secondary p-1 text-center">
          <BookOpenCheck className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-medium">{entry.title}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{entry.author}</p>
        <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-gold">
          <Clock3 className="h-3 w-3" />
          {entry.readerId ? "Continuar lendo" : "Ver detalhes"}
        </div>
      </div>
    </>
  );

  const className =
    "group grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition hover:border-gold/40 hover:bg-card";

  if (entry.readerId) {
    return (
      <Link to="/reader/$bookId" params={{ bookId: entry.readerId }} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <Link
      to="/livro/$slug"
      params={{ slug: slugFor(entry.title, entry.author) || "livro" }}
      search={{ title: entry.title, author: entry.author }}
      className={className}
    >
      {inner}
    </Link>
  );
}

function RankingCard() {
  const [rows, setRows] = useState<RankingRow[] | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => subscribeAuth(setUser), []);
  useEffect(() => subscribeRanking(4, setRows), []);

  return (
    <div className="glass-plate rounded-3xl p-7">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Ranking</p>
          <h3 className="mt-2 font-display text-2xl font-medium">Entre os leitores</h3>
        </div>
        <Trophy className="h-6 w-6 text-gold" />
      </div>

      {rows === undefined ? (
        <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>
      ) : !rows || rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Ainda ninguém pontuou — leia um capítulo e seja o primeiro do ranking!
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border/60">
          {rows.map((r) => {
            const me = user && !user.isAnonymous && r.uid === user.uid;
            return (
              <li
                key={r.uid}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3.5 ${
                  me ? "text-foreground" : "text-foreground/85"
                }`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-sm font-medium ${
                    me ? "bg-gold text-primary-foreground" : "bg-secondary text-foreground/70"
                  }`}
                >
                  {r.pos}
                </span>
                <span className={`truncate ${me ? "font-medium" : ""}`}>
                  {me ? "Você" : r.displayName}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {r.xp.toLocaleString("pt-BR")} XP
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        to="/ranking"
        className="mt-5 inline-flex items-center gap-1.5 text-sm text-gold hover:underline"
      >
        Ver ranking completo <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function AICard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-br from-surface-2 to-surface p-7">
      <div className="pointer-events-none absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-gold/15 blur-3xl" />
      <div className="relative">
        <p className="text-[11px] uppercase tracking-[0.28em] text-gold">IA literária</p>
        <h3 className="mt-2 font-display text-2xl font-medium">
          Uma companhia inteligente para cada capítulo.
        </h3>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          Resume trechos, explica palavras, contextualiza personagens e recomenda leituras — tudo
          dentro do livro que você está lendo.
        </p>
        <ul className="mt-5 space-y-2 text-sm">
          {[
            "Resumos de capítulos sob demanda",
            "Explicações de trechos difíceis",
            "Contexto histórico e cultural",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              {f}
            </li>
          ))}
        </ul>
        <LumiButton />
      </div>
    </div>
  );
}

function ChallengeCard({
  title,
  progress,
  pill,
}: {
  title: string;
  progress: number;
  pill: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 transition hover:border-gold/40">
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-gold/30 bg-gold/5 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-gold">
          {pill}
        </span>
        <BookMarked className="h-4 w-4 text-muted-foreground group-hover:text-gold" />
      </div>
      <h4 className="mt-5 font-display text-xl font-medium leading-snug">{title}</h4>
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progresso</span>
          <span className="text-gold">{progress}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <Link
        to="/desafios"
        className="mt-5 flex items-center gap-2 text-xs text-muted-foreground hover:text-gold"
      >
        <Bookmark className="h-3.5 w-3.5" /> Ver detalhes
      </Link>
    </div>
  );
}
