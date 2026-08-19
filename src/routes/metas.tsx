import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Target, Flame, BookOpenCheck, Heart, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { describeFirestoreError } from "@/lib/async-utils";
import { subscribeLibrary, type LibraryEntry } from "@/lib/library";
import { subscribeUserProfile, type UserProfile } from "@/lib/user-profile";
import {
  computeGoalProgress,
  currentYear,
  saveReadingGoal,
  subscribeReadingGoal,
  type ReadingGoal,
} from "@/lib/goals";
import { TelegramCard } from "@/components/telegram-card";

export const Route = createFileRoute("/metas")({
  head: () => ({
    meta: [
      { title: "Metas e hábitos de leitura — BookVerse" },
      {
        name: "description",
        content:
          "Defina sua meta anual de livros, acompanhe sua sequência de dias lendo e veja o ritmo necessário para bater o desafio.",
      },
      { property: "og:title", content: "Metas e hábitos de leitura — BookVerse" },
      {
        property: "og:description",
        content: "Meta anual, sequência de leitura e progresso das suas estantes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GuardedMetasPage,
});

function GuardedMetasPage() {
  const { state, user } = useRequireAuth();
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
  return <MetasPage uid={user.uid} />;
}

function MetasPage({ uid }: { uid: string }) {
  const year = currentYear();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [draft, setDraft] = useState("12");
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeLibrary(uid, setEntries), [uid]);
  useEffect(() => subscribeUserProfile(uid, setProfile), [uid]);
  useEffect(() => subscribeReadingGoal(uid, year, setGoal), [uid, year]);
  useEffect(() => {
    if (goal) setDraft(String(goal.books));
  }, [goal]);

  const progress = useMemo(
    () => computeGoalProgress(entries, goal?.books ?? 12),
    [entries, goal?.books],
  );

  const shelfCounts = useMemo(() => {
    const c = { lendo: 0, "quero-ler": 0, concluido: 0, relendo: 0, abandonado: 0 };
    for (const e of entries) if (e.status in c) c[e.status] += 1;
    return c;
  }, [entries]);

  const favorites = entries.filter((e) => e.favorite).length;

  async function handleSave() {
    const value = Number(draft);
    if (!Number.isFinite(value) || value < 1) {
      toast.error("Escolha um número de livros maior que zero.");
      return;
    }
    setSaving(true);
    try {
      await saveReadingGoal(uid, year, value);
      toast.success(`Meta de ${Math.round(value)} livros salva para ${year}.`);
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível salvar sua meta."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Hábitos</p>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Metas de leitura</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Defina quantos livros quer concluir em {year}. O progresso vem direto da sua estante
        “Concluídos” — nada de anotar duas vezes.
      </p>

      {/* Meta anual */}
      <section className="glass-plate mt-8 rounded-3xl p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-gold">
              <Target className="h-4 w-4" />
              <span className="text-[11px] uppercase tracking-[0.22em]">Desafio {year}</span>
            </div>
            <p className="mt-3 font-display text-3xl font-medium">
              {progress.completed}
              <span className="text-muted-foreground"> de {progress.target} livros</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {progress.remaining === 0
                ? "Meta batida. Que tal aumentar o desafio?"
                : `Faltam ${progress.remaining} · ritmo sugerido: ${progress.perMonthNeeded}/mês`}
            </p>
          </div>

          <div className="flex items-end gap-2">
            <label className="text-xs text-muted-foreground">
              Minha meta
              <input
                type="number"
                min={1}
                max={999}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="mt-1.5 block w-24 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/60"
              />
            </label>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Salvar
            </button>
          </div>
        </div>

        <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-secondary/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-oxide to-gold transition-[width] duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {progress.percent}% concluído ·{" "}
          {progress.onTrack ? "você está no ritmo" : "um pouco atrás do ritmo ideal"}
        </p>
      </section>

      {/* Hábito / sequência */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Sequência atual"
          value={`${profile?.currentStreak ?? 0} dia${(profile?.currentStreak ?? 0) === 1 ? "" : "s"}`}
          hint={`Recorde: ${profile?.longestStreak ?? 0}`}
        />
        <StatCard
          icon={<BookOpenCheck className="h-4 w-4" />}
          label="Capítulos lidos"
          value={String(profile?.chaptersRead ?? 0)}
          hint={`Nesta semana: ${profile?.weeklyChaptersRead ?? 0}`}
        />
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="Lendo agora"
          value={String(shelfCounts.lendo + shelfCounts.relendo)}
          hint={`Quero ler: ${shelfCounts["quero-ler"]}`}
        />
        <StatCard
          icon={<Heart className="h-4 w-4" />}
          label="Favoritos"
          value={String(favorites)}
          hint={`Abandonados: ${shelfCounts.abandonado}`}
        />
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/biblioteca"
          className="rounded-full border border-border/60 px-5 py-2.5 text-sm hover:border-gold/40 hover:text-gold"
        >
          Organizar estantes
        </Link>
        <Link
          to="/desafios"
          className="rounded-full border border-border/60 px-5 py-2.5 text-sm hover:border-gold/40 hover:text-gold"
        >
          Ver desafios e conquistas
        </Link>
      </div>

      <TelegramCard />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center gap-2 text-gold">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="mt-3 font-display text-2xl font-medium">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
