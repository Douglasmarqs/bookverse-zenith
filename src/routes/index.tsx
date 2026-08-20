import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Clock3,
  Flame,
  Highlighter,
  Library,
  MoonStar,
  Sparkles,
  StickyNote,
  Trophy,
  Type,
} from "lucide-react";

import heroImg from "@/assets/hero-library.webp";
import { LumiMascot } from "@/components/lumi-mascot";
import { LiteraryFactCard } from "@/components/literary-fact-card";
import { HabitSummary } from "@/components/habit-summary";
import { EpubImport } from "@/components/epub-import";

import { SAMPLE_BOOKS } from "@/lib/sample-book";
import { openLumiPanel } from "@/lib/lumi-panel-store";
import { subscribeRanking, type RankingRow } from "@/lib/ranking";
import { subscribeUserProfile } from "@/lib/user-profile";
import { maybeShowReadingReminder } from "@/lib/reading-reminder";
import { subscribeLibrary, slugFor, type LibraryEntry } from "@/lib/library";
import { useAuthUser } from "@/hooks/use-auth-user";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BookVerse — Leitor de EPUB com progresso sincronizado" },
      {
        name: "description",
        content:
          "Importe seus arquivos .epub e leia em um leitor imersivo estilo Kindle: temas, tipografia ajustável, marcações, notas e progresso sincronizado.",
      },
      { property: "og:title", content: "BookVerse — Seu leitor de EPUB premium" },
      {
        property: "og:description",
        content:
          "Leitor de EPUB com paginação, marcações, notas, IA literária e progresso salvo automaticamente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const user = useAuthUser();
  const signedIn = !!user && !user.isAnonymous;

  const [stats, setStats] = useState({ booksCompleted: 0, libraryCount: 0, xp: 0 });
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);

  useEffect(() => {
    if (!signedIn || !user) {
      setStats({ booksCompleted: 0, libraryCount: 0, xp: 0 });
      setEntries(null);
      return;
    }
    const unsubProfile = subscribeUserProfile(user.uid, (p) => {
      setStats((s) => ({ ...s, booksCompleted: p?.booksCompleted ?? 0, xp: p?.xp ?? 0 }));
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      maybeShowReadingReminder(p?.lastActiveDate === todayKey);
    });
    const unsubLibrary = subscribeLibrary(user.uid, (list) => {
      setEntries(list);
      setStats((s) => ({ ...s, libraryCount: list.length }));
    });
    return () => {
      unsubProfile();
      unsubLibrary();
    };
  }, [signedIn, user]);

  const reading = useMemo(
    () => (entries ?? []).filter((e) => e.status === "lendo").slice(0, 3),
    [entries],
  );
  const shelf = useMemo(
    () => (entries ?? []).filter((e) => !!e.readerId).slice(0, 6),
    [entries],
  );

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
            className="h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
        </div>

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-5 pt-16 pb-20 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-24 lg:pb-28">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1.5 text-xs font-medium text-gold-soft">
              <Sparkles className="h-3.5 w-3.5" />
              Leitor de EPUB completo, sem instalar nada
            </div>

            <h1 className="mt-6 font-display text-5xl font-medium leading-[1.02] tracking-tight md:text-6xl lg:text-7xl">
              Seus livros, <br />
              lidos com <span className="text-gradient-gold italic">calma</span>.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              Importe seus arquivos <code className="font-mono text-foreground/80">.epub</code> e
              leia em páginas de verdade: tipografia ajustável, temas de papel, marcações, notas e
              progresso que continua exatamente onde você parou — em qualquer aparelho.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/biblioteca"
                className="group inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {signedIn ? "Abrir minha estante" : "Criar minha estante"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/reader/$bookId"
                params={{ bookId: SAMPLE_BOOKS[0]!.id }}
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3.5 text-sm font-medium text-foreground/85 hover:border-gold/50 hover:text-foreground"
              >
                <BookOpenCheck className="h-4 w-4 text-gold" />
                Experimentar o leitor
              </Link>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
              {[
                { k: "4 temas", v: "de papel" },
                { k: "Offline", v: "leitura local" },
                { k: "Sync", v: "entre aparelhos" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="font-display text-xl font-semibold text-foreground">{s.k}</dt>
                  <dd className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col gap-4">
            <EpubImport />
            <LiteraryFactCard />
          </div>
        </div>

        <div className="hairline mx-auto max-w-7xl" />
      </section>

      {/* CONTINUE READING */}
      <Section
        eyebrow="Continue lendo"
        title="Retome de onde parou"
        action="Minha estante"
        actionTo="/biblioteca"
      >
        {reading.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reading.map((entry) => (
              <ContinueCard key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
            <p className="text-muted-foreground">
              {signedIn
                ? "Nenhuma leitura em andamento. Importe um EPUB acima ou comece por uma das histórias de demonstração."
                : "Entre na sua conta para ver aqui os livros que você está lendo."}
            </p>
            <Link
              to={signedIn ? "/biblioteca" : "/auth"}
              search={signedIn ? undefined : { redirect: "/biblioteca" }}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              {signedIn ? "Ir para a estante" : "Entrar"}
            </Link>
          </div>
        )}
      </Section>

      {/* HABIT / GOALS */}
      {signedIn && (
        <Section
          eyebrow="Seu hábito"
          title="Constância, meta e nível"
          action="Ver metas"
          actionTo="/metas"
          icon={<Flame className="h-4 w-4" />}
        >
          <HabitSummary uid={user!.uid} />
        </Section>
      )}



      {/* SHELF */}
      {shelf.length > 0 && (
        <Section
          eyebrow="Na sua estante"
          title="Prontos para abrir"
          action="Ver tudo"
          actionTo="/biblioteca"
          icon={<Library className="h-4 w-4" />}
        >
          <div className="grid grid-cols-3 gap-5 sm:grid-cols-4 lg:grid-cols-6">
            {shelf.map((entry) => (
              <Link
                key={entry.id}
                to="/reader/$bookId"
                params={{ bookId: entry.readerId! }}
                className="group text-left"
              >
                {entry.cover ? (
                  <img
                    src={entry.cover}
                    alt={entry.title}
                    loading="lazy"
                    className="book-shadow aspect-[2/3] w-full rounded-md object-cover transition-transform duration-500 group-hover:-translate-y-1"
                  />
                ) : (
                  <div className="book-shadow grid aspect-[2/3] w-full place-items-center rounded-md bg-secondary p-3 text-center">
                    <span className="font-display text-xs text-foreground/70">{entry.title}</span>
                  </div>
                )}
                <p className="mt-3 truncate text-sm font-medium">{entry.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.author}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* READER FEATURES */}
      <Section
        eyebrow="O leitor"
        title="Uma página de verdade, no seu ritmo"
        icon={<BookOpenCheck className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<Type className="h-5 w-5" />}
            title="Tipografia ajustável"
            text="Serifa ou sem serifa, tamanho, entrelinha, margem e largura de coluna — como no Kindle."
          />
          <FeatureCard
            icon={<MoonStar className="h-5 w-5" />}
            title="Temas de papel"
            text="Claro, papel, sépia e noturno, com paginação real por colunas ou rolagem contínua."
          />
          <FeatureCard
            icon={<Highlighter className="h-5 w-5" />}
            title="Marcações e notas"
            text="Selecione um trecho para destacar em quatro cores, anotar e reencontrar depois."
          />
          <FeatureCard
            icon={<StickyNote className="h-5 w-5" />}
            title="Progresso salvo"
            text="Percentual, capítulo e posição exata sincronizados automaticamente na sua conta."
          />
        </div>
      </Section>

      {/* DEMO STORIES — fully readable in-app */}
      <Section
        eyebrow="Demonstração"
        title="Histórias para testar o leitor"
        icon={<Sparkles className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {SAMPLE_BOOKS.map((book) => (
            <Link
              key={book.id}
              to="/reader/$bookId"
              params={{ bookId: book.id }}
              className="group grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl border border-border/60 bg-card/50 p-4 transition hover:border-gold/40 hover:bg-card"
            >
              {book.cover ? (
                <img
                  src={book.cover}
                  alt={book.title}
                  loading="lazy"
                  className="book-shadow h-28 w-20 rounded-md object-cover"
                />
              ) : (
                <div className="book-shadow grid h-28 w-20 place-items-center rounded-md bg-secondary" />
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-medium">{book.title}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{book.author}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-gold">
                  <Clock3 className="h-3 w-3" />
                  {book.chapters.length} capítulos
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* RANKING + LUMI */}
      <section className="content-auto mx-auto max-w-7xl px-5 py-10 md:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <RankingCard uid={signedIn ? user!.uid : null} />
          <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-gradient-to-br from-surface-2 to-surface p-7">
            <div className="pointer-events-none absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-gold/15 blur-3xl" />
            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.28em] text-gold">IA literária</p>
              <h3 className="mt-2 font-display text-2xl font-medium">Leia acompanhado da Lumi</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                Resumo do capítulo, explicação de trechos difíceis e contexto histórico — sem sair
                da página que você está lendo.
              </p>
              <button
                onClick={() => openLumiPanel(null)}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Conversar com a Lumi <ArrowRight className="h-4 w-4" />
              </button>
              <LumiMascot size={120} className="absolute -bottom-4 right-2 hidden md:block" />
            </div>
          </div>
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
            progress={Math.min(100, Math.round((stats.booksCompleted / 12) * 100))}
            pill="Anual"
          />
          <ChallengeCard
            title="Monte sua estante"
            progress={Math.min(100, Math.round((stats.libraryCount / 5) * 100))}
            pill="Biblioteca"
          />
          <ChallengeCard
            title="1000 XP"
            progress={Math.min(100, Math.round((stats.xp / 1000) * 100))}
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
              <p className="text-[11px] uppercase tracking-[0.3em] text-gold">Bookverse</p>
              <h2 className="mt-3 font-display text-4xl font-medium leading-tight md:text-5xl">
                Traga seus EPUBs. O resto é leitura.
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground">
                Nada de catálogos que não abrem: aqui só entram livros que você realmente consegue
                ler, com progresso, marcações e notas salvos na sua conta.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={signedIn ? "/biblioteca" : "/auth"}
                  search={signedIn ? undefined : { redirect: "/biblioteca" }}
                  className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-medium text-primary-foreground"
                >
                  {signedIn ? "Importar um EPUB" : "Começar grátis"}{" "}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/sobre"
                  className="inline-flex items-center rounded-full border border-border px-6 py-3.5 text-sm font-medium"
                >
                  Saiba mais
                </Link>
              </div>
            </div>
            <LumiMascot size={200} className="mx-auto" />
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
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  actionTo?: "/biblioteca" | "/desafios";
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
            className="shrink-0 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-gold"
          >
            {action} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-gold/12 text-gold">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

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

function RankingCard({ uid }: { uid: string | null }) {
  const [rows, setRows] = useState<RankingRow[] | null | undefined>(undefined);
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
            const me = uid === r.uid;
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
    <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
      <div className="flex items-center justify-between">
        <span className="rounded-full border border-gold/30 bg-gold/5 px-2.5 py-1 text-[10px] uppercase tracking-widest text-gold-soft">
          {pill}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">{progress}%</span>
      </div>
      <h3 className="mt-4 font-display text-lg font-medium">{title}</h3>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
