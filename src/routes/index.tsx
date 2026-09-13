import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Flame,
  Library,
  Sparkles,
  Trophy,
  UploadCloud,
} from "lucide-react";

import { EpubImport } from "@/components/epub-import";
import { LumiRecommendationCard } from "@/components/lumi-recommendation-card";
import { useAuthUser } from "@/hooks/use-auth-user";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";
import { subscribeReadingProgress, type StoredReadingProgress } from "@/lib/reader-store";
import { subscribeUserProfile, type UserProfile } from "@/lib/user-profile";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BookVerse — Sua leitura" },
      {
        name: "description",
        content: "Sua biblioteca, seu progresso e seus EPUBs privados em um leitor confortável.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const user = useAuthUser();
  const signedIn = Boolean(user && !user.isAnonymous);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[] | null>(null);
  const [progress, setProgress] = useState<StoredReadingProgress[]>([]);

  useEffect(() => {
    if (!signedIn || !user) {
      setProfile(null);
      setLibrary(null);
      setProgress([]);
      return;
    }
    const stopProfile = subscribeUserProfile(user.uid, setProfile);
    const stopLibrary = subscribeLibrary(user.uid, setLibrary);
    const stopProgress = subscribeReadingProgress(user.uid, setProgress);
    return () => {
      stopProfile();
      stopLibrary();
      stopProgress();
    };
  }, [signedIn, user]);

  const progressByReader = useMemo(
    () => new Map(progress.map((item) => [item.bookId, item])),
    [progress],
  );
  const current = useMemo(() => {
    const candidates = (library ?? []).filter(
      (entry) => entry.status === "lendo" && entry.readerId,
    );
    return candidates
      .map((entry) => ({ entry, progress: progressByReader.get(entry.readerId!) }))
      .sort((a, b) => (b.progress?.updatedAt ?? 0) - (a.progress?.updatedAt ?? 0))[0];
  }, [library, progressByReader]);
  const visibleBooks = useMemo(
    () => (library ?? []).filter((entry) => entry.readerId).slice(0, 6),
    [library],
  );
  const completed = (library ?? []).filter((entry) => entry.status === "concluido").length;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/50 p-6 md:p-9">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/10 blur-3xl"
          />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
              BookVerse
            </p>
            <h1 className="mt-3 font-display text-3xl font-medium leading-tight md:text-4xl">
              {signedIn
                ? "Sua leitura, no ponto em que você deixou."
                : "Uma estante feita para a sua leitura."}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {signedIn
                ? "Seu progresso e as preferências do leitor acompanham a conta. Seus EPUBs permanecem privados."
                : "Entre para guardar livros, importar EPUBs próprios e retomar a leitura em qualquer dispositivo."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {current?.entry.readerId ? (
                <Link
                  to="/reader/$bookId"
                  params={{ bookId: current.entry.readerId }}
                  className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-gold/15"
                >
                  Continuar lendo <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  to={signedIn ? "/descobrir" : "/auth"}
                  search={signedIn ? undefined : { redirect: "/" }}
                  className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-gold/15"
                >
                  {signedIn ? "Descobrir livros" : "Entrar na minha conta"}{" "}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                to="/biblioteca"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/40 px-5 py-3 text-sm font-semibold text-foreground/90 transition hover:border-gold/45 hover:text-gold"
              >
                <Library className="h-4 w-4" /> Minha biblioteca
              </Link>
            </div>
          </div>
        </div>
        <EpubImport />
      </section>

      <section className="mt-10">
        <SectionHeading eyebrow="Agora" title="Continue lendo" action="Ver biblioteca" />
        {current ? (
          <ContinueReading entry={current.entry} progress={current.progress} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 px-6 py-10 text-center">
            <BookOpenCheck className="mx-auto h-6 w-6 text-gold" />
            <p className="mt-3 font-medium">Ainda não há uma leitura em andamento.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {signedIn
                ? "Escolha um título de domínio público ou importe um EPUB que você possui."
                : "Entre para começar uma biblioteca e manter seu lugar de leitura."}
            </p>
            <Link
              to={signedIn ? "/descobrir" : "/auth"}
              search={signedIn ? undefined : { redirect: "/descobrir" }}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold/45 px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/10"
            >
              {signedIn ? "Abrir Descobrir" : "Entrar"} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      {signedIn && (
        <section className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
          <div>
            <SectionHeading eyebrow="Seu ritmo" title="O que sua conta registra" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Na biblioteca"
                value={library?.length ?? 0}
                icon={<Library className="h-4 w-4" />}
              />
              <Stat
                label="Concluídos"
                value={Math.max(profile?.booksCompleted ?? 0, completed)}
                icon={<Trophy className="h-4 w-4" />}
              />
              <Stat
                label="Capítulos lidos"
                value={profile?.chaptersRead ?? 0}
                icon={<BookOpenCheck className="h-4 w-4" />}
              />
              <Stat
                label="Sequência atual"
                value={profile?.currentStreak ?? 0}
                icon={<Flame className="h-4 w-4" />}
              />
            </div>
          </div>
          <div className="pt-0 lg:pt-10">
            <LumiRecommendationCard user={user} libraryEntries={library ?? []} />
          </div>
        </section>
      )}

      <section className="mt-12">
        <SectionHeading
          eyebrow="Sua estante"
          title="Livros que podem ser abertos aqui"
          action="Organizar biblioteca"
        />
        {visibleBooks.length ? (
          <div className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6">
            {visibleBooks.map((entry) => (
              <BookTile key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-card/30 p-6 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <UploadCloud className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <div>
                <p className="font-medium text-foreground">Sua estante está pronta.</p>
                <p className="mt-1">
                  Os livros que você importar e os títulos públicos que salvar aparecerão aqui.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {!signedIn && (
        <section className="mt-12 rounded-3xl border border-gold/25 bg-gold/5 p-7 md:flex md:items-center md:justify-between md:gap-8">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold">
              <Sparkles className="h-3.5 w-3.5" /> Leitura privada
            </p>
            <p className="mt-2 font-display text-2xl font-medium">
              Traga sua biblioteca para o BookVerse.
            </p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Crie uma conta para sincronizar progresso, preferências e os EPUBs que você adiciona.
            </p>
          </div>
          <Link
            to="/auth"
            search={{ redirect: "/" }}
            className="mt-5 inline-flex shrink-0 items-center gap-2 rounded-full bg-gold px-5 py-3 text-sm font-medium text-primary-foreground md:mt-0"
          >
            Criar conta <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: string;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">{eyebrow}</p>
        <h2 className="mt-1.5 font-display text-2xl font-medium md:text-3xl">{title}</h2>
      </div>
      {action && (
        <Link to="/biblioteca" className="shrink-0 text-sm font-medium text-gold hover:underline">
          {action}
        </Link>
      )}
    </header>
  );
}

function ContinueReading({
  entry,
  progress,
}: {
  entry: LibraryEntry;
  progress?: StoredReadingProgress;
}) {
  const ratio =
    progress?.overallRatio ??
    ((progress?.chapterIndex ?? 0) + (progress?.scrollRatio ?? 0)) /
      Math.max(1, progress?.chapterCount ?? 1);
  const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <Link
      to="/reader/$bookId"
      params={{ bookId: entry.readerId! }}
      className="group grid gap-5 rounded-3xl border border-border/70 bg-card/45 p-5 transition hover:border-gold/45 sm:grid-cols-[8rem_1fr] sm:p-6"
    >
      <>
        {entry.cover ? (
          <img
            src={entry.cover}
            alt={`Capa de ${entry.title}`}
            className="book-shadow aspect-[2/3] w-28 rounded-lg object-cover sm:w-32"
          />
        ) : (
          <div className="book-shadow grid aspect-[2/3] w-28 place-items-center rounded-lg bg-secondary p-3 text-center font-display text-sm sm:w-32">
            {entry.title}
          </div>
        )}
      </>
      <div className="flex min-w-0 flex-col justify-center">
        <p className="truncate font-display text-2xl font-medium">{entry.title}</p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{entry.author}</p>
        <div className="mt-6 max-w-xl">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {progress
                ? `Capítulo ${(progress.chapterIndex ?? 0) + 1}${progress.chapterCount ? ` de ${progress.chapterCount}` : ""}`
                : "Progresso será registrado ao ler"}
            </span>
            <span className="tabular-nums">{progress ? `${percent}%` : ""}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-gold">
          Abrir leitor{" "}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function BookTile({ entry }: { entry: LibraryEntry }) {
  return (
    <Link to="/reader/$bookId" params={{ bookId: entry.readerId! }} className="group min-w-0">
      {entry.cover ? (
        <img
          src={entry.cover}
          alt={`Capa de ${entry.title}`}
          loading="lazy"
          className="book-shadow aspect-[2/3] w-full rounded-md object-cover transition-transform duration-300 group-hover:-translate-y-1"
        />
      ) : (
        <div className="book-shadow grid aspect-[2/3] w-full place-items-center rounded-md bg-secondary p-3 text-center font-display text-xs text-foreground/70">
          {entry.title}
        </div>
      )}
      <p className="mt-2 truncate font-display text-sm font-medium">{entry.title}</p>
      <p className="truncate text-xs text-muted-foreground">{entry.author}</p>
    </Link>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/35 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-3 font-display text-3xl font-medium tabular-nums">{value}</p>
    </div>
  );
}
