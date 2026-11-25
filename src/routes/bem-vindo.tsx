import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import {
  Bell,
  BookText,
  Check,
  ChevronLeft,
  Compass,
  Ghost,
  Heart,
  Hourglass,
  Landmark,
  Map,
  Rocket,
  Search,
  Sparkles,
  Feather,
  Brain,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Lumi } from "@/components/brand/lumi";
import { haptic } from "@/components/motion/interactive";
import { useAuthUser } from "@/hooks/use-auth-user";
import { markStarted, OFFLINE_UID } from "@/lib/nav";
import { saveOnboarding, type ReadingMoment } from "@/lib/onboarding";
import { requestNotificationPermission } from "@/lib/reading-reminder";

export const Route = createFileRoute("/bem-vindo")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  head: () => ({
    meta: [{ title: "Bem-vindo — BookVerse" }, { name: "robots", content: "noindex" }],
  }),
  component: Onboarding,
});

const EASE = [0.16, 1, 0.3, 1] as const;

const TASTES: { id: string; label: string; icon: typeof Heart; bg: string }[] = [
  { id: "romance", label: "Romance", icon: Heart, bg: "var(--rose)" },
  { id: "misterio", label: "Mistério", icon: Search, bg: "var(--sky)" },
  { id: "classicos-br", label: "Clássicos", icon: Landmark, bg: "var(--butter)" },
  { id: "fantasia", label: "Fantasia", icon: Sparkles, bg: "var(--lilac)" },
  { id: "gotico", label: "Terror", icon: Ghost, bg: "var(--surface-2)" },
  { id: "poesia", label: "Poesia", icon: Feather, bg: "var(--mint)" },
  { id: "aventura", label: "Aventura", icon: Map, bg: "var(--accent-soft)" },
  { id: "ficcao-cientifica", label: "Ficção científica", icon: Rocket, bg: "var(--sky)" },
  { id: "filosofia", label: "Filosofia", icon: Brain, bg: "var(--lilac)" },
  { id: "contos", label: "Contos", icon: BookText, bg: "var(--butter)" },
  { id: "historia", label: "História", icon: Hourglass, bg: "var(--mint)" },
  { id: "biografias", label: "Biografias", icon: UserRound, bg: "var(--rose)" },
];

const PACES = [
  { min: 5, label: "Leve", hint: "5 min · Um conto por semana" },
  { min: 15, label: "Constante", hint: "15 min · ≈ 1 livro por mês" },
  { min: 30, label: "Dedicado", hint: "30 min · ≈ 2 livros por mês" },
  { min: 60, label: "Maratona", hint: "60 min · ≈ 4 livros por mês" },
];

const TIMES: { moment: ReadingMoment; label: string }[] = [
  { moment: "noite", label: "21:30" },
  { moment: "manha", label: "07:30" },
  { moment: "tarde", label: "13:00" },
];

function Onboarding() {
  const user = useAuthUser();
  const member = !!user && !user.isAnonymous;
  const navigate = useNavigate();
  const router = useRouter();
  const search = Route.useSearch();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [tastes, setTastes] = useState<string[]>([]);
  const [pace, setPace] = useState(15);
  const [reminder, setReminder] = useState(true);
  const [time, setTime] = useState(0);
  const [saving, setSaving] = useState(false);

  function go(next: number) {
    haptic(6);
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  function toggle(id: string) {
    haptic(4);
    setTastes((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  }

  async function finish(skip = false) {
    setSaving(true);
    const uid = member ? user!.uid : (user?.uid ?? OFFLINE_UID);
    try {
      if (!skip && reminder) void requestNotificationPermission().catch(() => {});
      await saveOnboarding(uid, {
        genres: skip ? [] : tastes,
        dailyMinutes: skip ? 15 : pace,
        moment: TIMES[time]!.moment,
        completedAt: Date.now(),
      }).catch((err) => {
        // Guests keep the local copy; only members need the account copy.
        if (member) throw err;
      });
      markStarted();
      const back = search.redirect && search.redirect !== "/auth" ? search.redirect : "/";
      void navigate({ to: back, replace: true });
    } catch {
      toast.error("Não foi possível salvar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 50 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -50 }),
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <header className="-mx-1 flex items-center justify-between">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => (step > 0 ? go(step - 1) : router.history.back())}
          className="press grid h-[42px] w-[42px] place-items-center rounded-full"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </button>
        <div className="flex items-center gap-1.5" aria-label={`Passo ${step + 1} de 3`}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-[6px] rounded-full transition-all duration-300 ${
                i <= step ? "w-[22px] bg-foreground" : "w-[6px] bg-border"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => void finish(true)}
          className="h-[42px] px-2 text-[15px] font-semibold text-muted-foreground"
        >
          Pular
        </button>
      </header>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.section
          key={step}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: EASE }}
          className="flex flex-1 flex-col"
        >
          {step === 0 ? (
            <div className="flex flex-1 flex-col items-center text-center">
              <div className="relative mt-[6vh]">
                <div
                  aria-hidden
                  className="absolute inset-x-[-40px] top-6 h-[220px] rounded-full bg-[radial-gradient(closest-side,#ffe1d3,transparent)] dark:opacity-30"
                />
                <Lumi pose="hello" size={220} bob />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 24 }}
                className="mt-3 max-w-[320px] rounded-[22px] bg-card px-5 py-4 text-[16.5px] leading-snug shadow-[0_16px_34px_-18px_rgba(0,0,0,.3),inset_0_0_0_1px_var(--border)]"
              >
                Oi! Eu sou a <b>Lumi</b>. Vou te ajudar a ler mais — e melhor. 📖
              </motion.div>
              <p className="mt-5 max-w-[300px] text-[15px] text-muted-foreground">
                Duas perguntas rápidas e sua estante fica com a sua cara.
              </p>
              <div className="mt-auto w-full pt-6">
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="press flex h-[56px] w-full items-center justify-center rounded-full bg-gold text-[16.5px] font-semibold text-white shadow-[0_14px_30px_-14px_#ff4d1a]"
                >
                  Vamos lá
                </button>
              </div>
            </div>
          ) : step === 1 ? (
            <>
              <h1 className="mt-6 font-display text-[36px] leading-[1.02] tracking-[-0.04em]">
                O que você gosta de ler?
              </h1>
              <p className="mt-3 text-[15.5px] leading-relaxed text-muted-foreground">
                Escolha 3 ou mais. Montamos sua estante na hora.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                {TASTES.map((t) => {
                  const on = tastes.includes(t.id);
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(t.id)}
                      className={`press relative flex h-[58px] items-center gap-3 rounded-[18px] px-3 text-left transition-[box-shadow] ${
                        on ? "shadow-[inset_0_0_0_2.5px_var(--foreground)]" : ""
                      }`}
                      style={{ background: t.bg }}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white/80 text-[#131313]">
                        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 text-[15px] font-semibold leading-tight text-[#131313]">
                        {t.label}
                      </span>
                      <AnimatePresence>
                        {on && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#131313] text-white"
                          >
                            <Check className="h-3 w-3" strokeWidth={3.2} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  );
                })}
              </div>
              <div className="mt-auto pt-6">
                <button
                  type="button"
                  disabled={tastes.length < 3}
                  onClick={() => go(2)}
                  className="press flex h-[56px] w-full items-center justify-center rounded-full bg-foreground text-[16.5px] font-semibold text-background transition-opacity disabled:opacity-35"
                >
                  {tastes.length < 3
                    ? `Escolha mais ${3 - tastes.length}`
                    : `Continuar · ${tastes.length} escolhidos`}
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-6 font-display text-[36px] leading-[1.02] tracking-[-0.04em]">
                Quanto tempo por dia?
              </h1>
              <p className="mt-3 text-[15.5px] leading-relaxed text-muted-foreground">
                Pequenas metas criam o hábito. Dá para mudar quando quiser.
              </p>
              <div role="radiogroup" aria-label="Minutos por dia" className="mt-6 space-y-2.5">
                {PACES.map((p) => {
                  const on = pace === p.min;
                  return (
                    <button
                      key={p.min}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        haptic(4);
                        setPace(p.min);
                      }}
                      className={`press flex w-full items-center gap-4 rounded-[22px] px-5 py-3.5 text-left transition ${
                        on
                          ? "bg-accent-soft shadow-[inset_0_0_0_2px_var(--gold)]"
                          : "bg-card shadow-[inset_0_0_0_1px_var(--border)]"
                      }`}
                    >
                      <span
                        className={`num w-[52px] font-display text-[32px] leading-none tracking-[-0.04em] ${on ? "text-gold" : ""}`}
                      >
                        {p.min}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-bold">{p.label}</span>
                        <span className="mt-0.5 block text-[13.5px] text-muted-foreground">
                          {p.hint}
                        </span>
                      </span>
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                          on ? "bg-gold text-white" : "shadow-[inset_0_0_0_1.5px_var(--border)]"
                        }`}
                      >
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3.2} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2.5 flex items-center gap-3.5 rounded-[22px] bg-card px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--border)]">
                <Bell className="h-5 w-5 shrink-0" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">Lembrete diário</p>
                  <button
                    type="button"
                    onClick={() => setTime((t) => (t + 1) % TIMES.length)}
                    className="mt-0.5 text-[13.5px] text-muted-foreground underline decoration-dotted underline-offset-4"
                    aria-label="Mudar horário do lembrete"
                  >
                    Todo dia às {TIMES[time]!.label}
                  </button>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reminder}
                  aria-label="Lembrete diário"
                  onClick={() => setReminder((r) => !r)}
                  className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
                    reminder ? "bg-success" : "bg-surface-2"
                  }`}
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow ${
                      reminder ? "right-[2px]" : "left-[2px]"
                    }`}
                  />
                </button>
              </div>
              <div className="mt-auto pt-6">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void finish()}
                  className="press flex h-[56px] w-full items-center justify-center gap-2 rounded-full bg-foreground text-[16.5px] font-semibold text-background disabled:opacity-60"
                >
                  <Compass className="h-5 w-5" /> Montar minha estante
                </button>
              </div>
            </>
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
