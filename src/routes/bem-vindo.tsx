import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Coffee, Loader2, Moon, Sun, Sunset } from "lucide-react";
import { toast } from "sonner";

import { AmbiencePicker } from "@/components/ambience-picker";
import { Logo } from "@/components/brand/logo";
import { LumiMascot } from "@/components/lumi-mascot";
import { haptic } from "@/components/motion/interactive";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { describeFirestoreError } from "@/lib/async-utils";
import { LUMI_PICKS } from "@/lib/editorial";
import { addToLibrary } from "@/lib/library";
import { GENRES, PICK_GENRES, saveOnboarding, type ReadingMoment } from "@/lib/onboarding";
import { gutenbergReaderId } from "@/lib/public-domain";

export const Route = createFileRoute("/bem-vindo")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  head: () => ({
    meta: [{ title: "Bem-vindo — BookVerse" }, { name: "robots", content: "noindex" }],
  }),
  component: Onboarding,
});

const EASE = [0.16, 1, 0.3, 1] as const;
const STEPS = ["Seu gosto", "Seu ritual", "Seu ambiente", "Seu primeiro livro"];

const MINUTES = [
  { value: 10, label: "10 min", hint: "Um capítulo curto" },
  { value: 20, label: "20 min", hint: "O ritual mais comum" },
  { value: 30, label: "30 min", hint: "Para engatar a história" },
  { value: 45, label: "45 min", hint: "Leitor de maratona" },
];

const MOMENTS: { value: ReadingMoment; label: string; icon: typeof Sun }[] = [
  { value: "manha", label: "De manhã", icon: Coffee },
  { value: "tarde", label: "À tarde", icon: Sun },
  { value: "noite", label: "À noite", icon: Moon },
  { value: "qualquer", label: "Quando der", icon: Sunset },
];

function Onboarding() {
  const { state, user } = useRequireAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [genres, setGenres] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(20);
  const [moment, setMoment] = useState<ReadingMoment>("noite");
  const [pick, setPick] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // One book per chosen genre first (in the order they were picked), then
  // the closest overall matches, so every taste is represented.
  const suggestions = useMemo(() => {
    const chosen: (typeof LUMI_PICKS)[number][] = [];
    for (const g of genres) {
      const hit = LUMI_PICKS.find(
        (p) => (PICK_GENRES[p.gutenbergId] ?? []).includes(g) && !chosen.includes(p),
      );
      if (hit) chosen.push(hit);
      if (chosen.length === 3) break;
    }
    const rest = LUMI_PICKS.filter((p) => !chosen.includes(p)).sort(
      (a, b) =>
        (PICK_GENRES[b.gutenbergId] ?? []).filter((g) => genres.includes(g)).length -
          (PICK_GENRES[a.gutenbergId] ?? []).filter((g) => genres.includes(g)).length ||
        a.minutes - b.minutes,
    );
    return [...chosen, ...rest].slice(0, 3).map((p) => ({ p }));
  }, [genres]);

  if (state !== "authenticated" || !user) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  const canNext = step === 0 ? genres.length >= 3 : step === 3 ? pick !== null : true;

  function go(next: number) {
    haptic(6);
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  async function finish(openBook: boolean) {
    if (!user) return;
    setSaving(true);
    try {
      await saveOnboarding(user.uid, {
        genres,
        dailyMinutes: minutes,
        moment,
        completedAt: Date.now(),
      });
      const chosen = LUMI_PICKS.find((p) => p.gutenbergId === pick);
      if (openBook && chosen) {
        const readerId = gutenbergReaderId(chosen.gutenbergId);
        await addToLibrary(
          user.uid,
          {
            title: chosen.title,
            author: chosen.author,
            cover: `https://www.gutenberg.org/cache/epub/${chosen.gutenbergId}/pg${chosen.gutenbergId}.cover.medium.jpg`,
            readerId,
          },
          "lendo",
        );
        toast.success(`“${chosen.title}” está na sua estante. Boa leitura!`);
        void navigate({ to: "/reader/$bookId", params: { bookId: readerId } });
        return;
      }
      void navigate({ to: search.redirect && search.redirect !== "/auth" ? search.redirect : "/" });
    } catch (err) {
      toast.error(describeFirestoreError(err, "Não foi possível concluir agora."));
    } finally {
      setSaving(false);
    }
  }

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 60, filter: "blur(6px)" }),
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -60, filter: "blur(6px)" }),
  };

  return (
    <div className="relative mx-auto flex min-h-[calc(100dvh-5rem)] max-w-5xl flex-col px-5 pb-10 pt-6 md:px-8">
      <div
        aria-hidden
        className="lamp-glow lamp-breathe pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2"
      />

      <div className="relative mb-6 flex justify-center">
        <Logo size={32} />
      </div>

      {/* progress */}
      <div className="relative flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <span className="relative block h-1 w-12 overflow-hidden rounded-full bg-border sm:w-20">
              <motion.span
                className="absolute inset-0 origin-left rounded-full bg-gold"
                animate={{ scaleX: i <= step ? 1 : 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </span>
            <span
              className={`hidden text-[11px] sm:block ${i === step ? "text-gold" : "text-muted-foreground"}`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="relative mt-8 flex-1">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.section
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: EASE }}
          >
            {step === 0 && (
              <StepHeader
                eyebrow="Passo 1 de 4 · Seu gosto"
                title={
                  <>
                    Puxe da estante o que <span className="italic text-gold">te chama.</span>
                  </>
                }
                text="Escolha pelo menos três. A Lumi usa isso para sugerir seus primeiros livros."
              >
                <div className="mt-10 overflow-x-auto pb-2">
                  <div className="mx-auto flex h-72 min-w-max items-end justify-center gap-1.5 px-2 sm:h-80">
                    {GENRES.map((g, i) => {
                      const on = genres.includes(g.id);
                      return (
                        <motion.button
                          key={g.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            haptic(5);
                            setGenres((cur) =>
                              cur.includes(g.id) ? cur.filter((x) => x !== g.id) : [...cur, g.id],
                            );
                          }}
                          initial={reduce ? false : { y: 40, opacity: 0, rotate: 180 }}
                          animate={{ y: on ? -30 : 0, opacity: 1, rotate: 180 }}
                          whileHover={reduce ? undefined : { y: on ? -30 : -10 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                            delay: reduce ? 0 : i * 0.03,
                          }}
                          className="spine relative w-12 cursor-pointer text-lg outline-none focus-visible:ring-2 focus-visible:ring-gold sm:w-14 sm:text-xl"
                          style={
                            {
                              "--s-bg": g.color,
                              "--s-fg": "fg" in g ? g.fg : undefined,
                              height: `${72 + ((i * 29) % 28)}%`,
                              boxShadow: on
                                ? "0 0 0 2px var(--gold), 0 26px 40px -12px color-mix(in oklab, var(--gold) 55%, transparent)"
                                : undefined,
                            } as React.CSSProperties
                          }
                        >
                          {g.label}
                          <AnimatePresence>
                            {on && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                className="grid h-6 w-6 rotate-180 place-items-center rounded-full bg-gold text-primary-foreground [writing-mode:horizontal-tb]"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="shelfboard mx-auto max-w-4xl" />
                </div>
              </StepHeader>
            )}

            {step === 1 && (
              <StepHeader
                eyebrow="Passo 2 de 4 · Seu ritual"
                title={
                  <>
                    Quanto tempo por dia <span className="italic text-gold">é seu?</span>
                  </>
                }
                text="Uma meta pequena e diária cria o hábito. Você pode mudar quando quiser."
              >
                <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
                  {MINUTES.map((m) => {
                    const on = minutes === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          haptic(5);
                          setMinutes(m.value);
                        }}
                        aria-pressed={on}
                        className={`press relative flex flex-col items-center rounded-3xl border p-5 text-center transition ${
                          on
                            ? "border-gold bg-gold/10"
                            : "border-border bg-card/60 hover:border-gold/40"
                        }`}
                      >
                        <span className="flex h-12 items-end gap-1">
                          {Array.from({ length: Math.max(1, m.value / 10) }, (_, i) => (
                            <span key={i} className="flex flex-col items-center">
                              <span
                                className={`h-3 w-2 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] ${on ? "flame bg-[radial-gradient(circle_at_50%_70%,#fff3cf,#f3cd84_40%,#e0703f_80%)] shadow-[0_0_12px_rgb(243_205_132/0.8)]" : "bg-transparent"}`}
                              />
                              <span
                                className={`w-2.5 rounded-t-[2px] ${on ? "bg-[linear-gradient(90deg,#d8ccb3,#f1e7d3,#cbbd9f)]" : "bg-border"}`}
                                style={{ height: 18 + i * 4 }}
                              />
                            </span>
                          ))}
                        </span>
                        <span className="mt-3 font-display text-3xl">{m.label}</span>
                        <span className="text-xs text-muted-foreground">{m.hint}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-10 text-center text-sm text-muted-foreground">
                  Quando você costuma ler?
                </p>
                <div className="mx-auto mt-3 flex max-w-xl flex-wrap justify-center gap-2">
                  {MOMENTS.map((m) => {
                    const on = moment === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMoment(m.value)}
                        aria-pressed={on}
                        className={`press inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition ${
                          on
                            ? "border-gold bg-gold/10 text-gold"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <m.icon className="h-4 w-4" /> {m.label}
                      </button>
                    );
                  })}
                </div>
              </StepHeader>
            )}

            {step === 2 && (
              <StepHeader
                eyebrow="Passo 3 de 4 · Seu ambiente"
                title={
                  <>
                    Como deve ser <span className="italic text-gold">o seu canto?</span>
                  </>
                }
                text="Toque para experimentar. O app inteiro muda na hora. O leitor tem temas próprios."
              >
                <div className="mx-auto mt-10 max-w-4xl">
                  <AmbiencePicker />
                </div>
              </StepHeader>
            )}

            {step === 3 && (
              <StepHeader
                eyebrow="Passo 4 de 4 · Seu primeiro livro"
                title={
                  <>
                    A Lumi separou <span className="italic text-gold">três para você.</span>
                  </>
                }
                text="Escolha um para começar agora. Os outros ficam esperando no acervo."
              >
                <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
                  {suggestions.map(({ p }, i) => {
                    const on = pick === p.gutenbergId;
                    return (
                      <motion.button
                        key={p.gutenbergId}
                        type="button"
                        onClick={() => {
                          haptic(6);
                          setPick(p.gutenbergId);
                        }}
                        aria-pressed={on}
                        initial={reduce ? false : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
                        className={`press relative flex flex-col rounded-3xl border p-5 text-left transition ${
                          on
                            ? "border-gold bg-gold/10"
                            : "border-border bg-card/60 hover:border-gold/40"
                        }`}
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                          {p.mood}
                        </span>
                        <span className="mt-2 font-display text-3xl leading-tight">{p.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {p.author} · {Math.round(p.minutes / 60)}h de leitura
                        </span>
                        <span className="mt-4 flex gap-2.5 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
                          <LumiMascot size={30} className="shrink-0" />
                          <span className="line-clamp-4 font-[family-name:var(--font-book)] italic">
                            {p.lumiNote}
                          </span>
                        </span>
                        {on && (
                          <motion.span
                            layoutId="pick-check"
                            className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-gold text-primary-foreground"
                          >
                            <Check className="h-4 w-4" />
                          </motion.span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </StepHeader>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      {/* footer actions */}
      <div className="relative mt-10 flex flex-wrap items-center justify-center gap-3">
        {step === 0 && (
          <span
            className={`rounded-full border px-3 py-1.5 text-xs ${genres.length >= 3 ? "border-gold/50 text-gold" : "border-border text-muted-foreground"}`}
          >
            {genres.length} de 3 escolhidos
          </span>
        )}
        {step > 0 && (
          <button type="button" onClick={() => go(step - 1)} className="btn-ghost">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        )}
        {step < 3 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => go(step + 1)}
            className="btn-primary px-8 disabled:pointer-events-none disabled:opacity-40"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => void finish(false)}
              className="btn-ghost"
            >
              Explorar depois
            </button>
            <button
              type="button"
              disabled={!canNext || saving}
              onClick={() => void finish(true)}
              className="btn-primary px-8 disabled:pointer-events-none disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Começar a ler <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {step === 0 && (
        <button
          type="button"
          onClick={() => void finish(false)}
          className="mx-auto mt-4 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Pular por agora
        </button>
      )}
    </div>
  );
}

function StepHeader({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 font-display text-5xl leading-[0.95] md:text-6xl">{title}</h1>
        <p className="mt-4 text-muted-foreground">{text}</p>
      </div>
      {children}
    </div>
  );
}
