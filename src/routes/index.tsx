import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BookMarked,
  Bookmark,
  Flame,
  Sparkles,
  Star,
  Trophy,
  Clock3,
  Play,
} from "lucide-react";

import heroImg from "@/assets/hero-library.jpg";
import owl from "@/assets/owl-mascot.png";
import b1 from "@/assets/book-1.jpg";
import b2 from "@/assets/book-2.jpg";
import b3 from "@/assets/book-3.jpg";
import b4 from "@/assets/book-4.jpg";
import b5 from "@/assets/book-5.jpg";
import b6 from "@/assets/book-6.jpg";

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

type Book = { title: string; author: string; cover: string; tag?: string };

const CONTINUE: Book[] = [
  { title: "A Casa dos Espíritos", author: "Isabel Allende", cover: b1, tag: "48%" },
  { title: "Meridiano de Sangue", author: "Cormac McCarthy", cover: b3, tag: "72%" },
  { title: "Solaris", author: "Stanislaw Lem", cover: b6, tag: "12%" },
];

const TRENDING: Book[] = [
  { title: "Cidades de Papel", author: "L. Marín", cover: b2 },
  { title: "O Círculo", author: "Ana Torres", cover: b4 },
  { title: "Herbário", author: "Julia Bäcker", cover: b2 },
  { title: "A Constelação", author: "M. Vidal", cover: b6 },
  { title: "Fogueira Interior", author: "R. Delgado", cover: b5 },
  { title: "Espelho de Bronze", author: "Ivo Kalman", cover: b3 },
];

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
                params={{ bookId: "casa-espiritos" }}
                className="group inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Começar a ler
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/reader/$bookId"
                params={{ bookId: "casa-espiritos" }}
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

          {/* Featured book plate */}
          <div className="relative flex items-center justify-center">
            <div className="glass-plate relative w-full max-w-sm rounded-3xl p-6 [box-shadow:var(--shadow-plate)]">
              <div className="relative">
                <img
                  src={b1}
                  alt=""
                  width={800}
                  height={1200}
                  className="book-shadow mx-auto aspect-[2/3] w-56 rounded-md object-cover"
                />
                <div className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-gold/15 blur-3xl" />
              </div>
              <div className="mt-6 text-center">
                <p className="text-[11px] uppercase tracking-[0.25em] text-gold">Destaque da semana</p>
                <h3 className="mt-2 font-display text-xl font-semibold">A Casa dos Espíritos</h3>
                <p className="mt-1 text-sm text-muted-foreground">Isabel Allende</p>
                <div className="mt-4 flex items-center justify-center gap-1 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                  <span className="ml-2 text-xs text-muted-foreground">4.9 · 12.4k</span>
                </div>
              </div>
            </div>

            <img
              src={owl}
              alt=""
              width={1024}
              height={1024}
              className="animate-float absolute -bottom-6 -left-4 hidden h-32 w-32 select-none md:block"
            />
          </div>
        </div>

        <div className="hairline mx-auto max-w-7xl" />
      </section>

      {/* CONTINUE READING */}
      <Section
        eyebrow="Continue lendo"
        title="Retome de onde parou"
        action="Ver tudo"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONTINUE.map((book) => (
            <ContinueCard key={book.title} book={book} />
          ))}
        </div>
      </Section>

      {/* TRENDING RAIL */}
      <Section
        eyebrow="Em alta"
        title="O que a comunidade está lendo"
        action="Descobrir"
        icon={<Flame className="h-4 w-4" />}
      >
        <div className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 md:-mx-8 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TRENDING.map((book, i) => (
            <BookCard key={book.title + i} book={book} rank={i + 1} />
          ))}
        </div>
      </Section>

      {/* CATEGORIES */}
      <Section eyebrow="Explorar" title="Por categoria">
        <div className="flex flex-wrap gap-2.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className="rounded-full border border-border bg-secondary/40 px-4 py-2 text-sm text-foreground/85 transition hover:border-gold/40 hover:text-gold"
            >
              {c}
            </button>
          ))}
        </div>
      </Section>

      {/* SPLIT: RANKING + AI */}
      <section className="mx-auto max-w-7xl px-5 py-10 md:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <RankingCard />
          <AICard />
        </div>
      </section>

      {/* CHALLENGES */}
      <Section eyebrow="Desafios" title="Metas que valem uma medalha" icon={<Trophy className="h-4 w-4" />}>
        <div className="grid gap-4 md:grid-cols-3">
          <ChallengeCard title="12 livros em 2026" progress={35} pill="Anual" />
          <ChallengeCard title="Semana clássica" progress={70} pill="Semanal" />
          <ChallengeCard title="Streak de 30 dias" progress={53} pill="Streak" />
        </div>
      </Section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-24 md:px-8">
        <div className="glass-plate relative overflow-hidden rounded-3xl px-8 py-14 md:px-14">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-gold">Bookverse Premium</p>
              <h2 className="mt-3 font-display text-4xl font-medium leading-tight md:text-5xl">
                Sua biblioteca, elegante em qualquer dispositivo.
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground">
                Sincronização em todos os aparelhos, leitor personalizável, IA literária e
                progresso salvo automaticamente.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-medium text-primary-foreground"
                >
                  Começar grátis <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center rounded-full border border-border px-6 py-3.5 text-sm font-medium"
                >
                  Comparar planos
                </Link>
              </div>
            </div>
            <img
              src={owl}
              alt=""
              width={1024}
              height={1024}
              loading="lazy"
              className="mx-auto h-48 w-48 md:h-56 md:w-56"
            />
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
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14">
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
        {action && (
          <button className="shrink-0 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold transition">
            {action} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

function BookCard({ book, rank }: { book: Book; rank?: number }) {
  return (
    <button className="group relative w-40 shrink-0 snap-start text-left sm:w-44">
      <div className="relative">
        <img
          src={book.cover}
          alt={book.title}
          width={800}
          height={1200}
          loading="lazy"
          className="book-shadow aspect-[2/3] w-full rounded-md object-cover transition-transform duration-500 group-hover:-translate-y-1"
        />
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
    </button>
  );
}

function ContinueCard({ book }: { book: Book }) {
  return (
    <button className="group grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition hover:border-gold/40 hover:bg-card">
      <img
        src={book.cover}
        alt={book.title}
        width={800}
        height={1200}
        loading="lazy"
        className="book-shadow h-28 w-20 rounded-md object-cover"
      />
      <div className="min-w-0">
        <p className="truncate font-display text-lg font-medium">{book.title}</p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{book.author}</p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock3 className="h-3 w-3" /> Cap. 12
            </span>
            <span className="font-medium text-gold">{book.tag}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft"
              style={{ width: book.tag }}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

function RankingCard() {
  const rows = [
    { name: "Marina C.", xp: "48.320", pos: 1 },
    { name: "Você", xp: "42.108", pos: 2, me: true },
    { name: "Rafael T.", xp: "39.740", pos: 3 },
    { name: "Léa V.", xp: "35.902", pos: 4 },
  ];
  return (
    <div className="glass-plate rounded-3xl p-7">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Ranking semanal</p>
          <h3 className="mt-2 font-display text-2xl font-medium">Entre os leitores</h3>
        </div>
        <Trophy className="h-6 w-6 text-gold" />
      </div>
      <ul className="mt-6 divide-y divide-border/60">
        {rows.map((r) => (
          <li
            key={r.name}
            className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3.5 ${
              r.me ? "text-foreground" : "text-foreground/85"
            }`}
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-full text-sm font-medium ${
                r.me ? "bg-gold text-primary-foreground" : "bg-secondary text-foreground/70"
              }`}
            >
              {r.pos}
            </span>
            <span className={`truncate ${r.me ? "font-medium" : ""}`}>{r.name}</span>
            <span className="text-sm tabular-nums text-muted-foreground">{r.xp} XP</span>
          </li>
        ))}
      </ul>
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
        <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground/95 px-5 py-2.5 text-sm font-medium text-background hover:bg-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Conhecer a IA
        </button>
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
      <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Bookmark className="h-3.5 w-3.5" /> 3 livros contam para essa meta
      </div>
    </div>
  );
}
