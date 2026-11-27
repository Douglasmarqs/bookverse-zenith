import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { ArrowUp, Loader2, Trash2, X } from "lucide-react";
import { LumiFace } from "@/components/brand/lumi";
import { LumiMascot } from "@/components/lumi-mascot";
import {
  closeLumiPanel,
  openLumiPanel,
  useLumiPanelState,
  type LumiContext,
} from "@/lib/lumi-panel-store";
import { askLumi, type LumiMessage } from "@/lib/lumi";
import { subscribeAuth } from "@/lib/firebase";
import {
  clearLumiHistory,
  contextKeyFor,
  loadLumiHistory,
  saveLumiHistory,
} from "@/lib/lumi-history";
import type { User } from "firebase/auth";

const SUGGESTIONS: Array<{
  label: string;
  text: string;
  topic: NonNullable<LumiContext["topic"]>;
}> = [
  {
    label: "Quem é quem aqui?",
    text: "Quem são as pessoas ou personagens mencionados neste trecho?",
    topic: "character",
  },
  {
    label: "Resumo até aqui",
    text: "Resuma o que li até aqui, sem revelar o que vem depois.",
    topic: "summary",
  },
  {
    label: "Contexto da época",
    text: "Qual é o contexto histórico ou cultural desta obra?",
    topic: "explanation",
  },
  {
    label: "Perguntas de revisão",
    text: "Crie 3 perguntas curtas para eu revisar este capítulo.",
    topic: "question",
  },
  {
    label: "Flashcards",
    text: "Crie flashcards curtos para revisar este trecho.",
    topic: "flashcards",
  },
];

function greeting(context: LumiContext | null): LumiMessage {
  return {
    role: "assistant",
    text: context?.bookTitle
      ? `Olá! Estou acompanhando "${context.bookTitle}" com você. Posso resumir, explicar trechos ou dar contexto — o que você gostaria de saber?`
      : "Olá, eu sou a Lumi 🦉 — sua companhia de leitura. Posso resumir capítulos, explicar trechos difíceis ou recomendar livros parecidos. Como posso ajudar?",
  };
}

export function LumiPanel() {
  const { open, context } = useLumiPanelState();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<LumiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const autoPromptRef = useRef<string | null>(null);
  const contextKey = contextKeyFor(context?.bookTitle, context?.topic);
  const canPersist = !!user && !user.isAnonymous;

  useEffect(() => subscribeAuth(setUser), []);

  // Esc closes the panel, like every other sheet in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLumiPanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Load this context's saved thread (if any) once per open+context+account.
  useEffect(() => {
    if (!open) return;
    setHistoryLoaded(false);
    if (!canPersist) {
      setMessages([greeting(context ?? null)]);
      setHistoryLoaded(true);
      return;
    }
    let cancelled = false;
    loadLumiHistory(user!.uid, contextKey).then((saved) => {
      if (cancelled) return;
      setMessages(saved.length > 0 ? saved : [greeting(context ?? null)]);
      setHistoryLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contextKey, canPersist]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string, display?: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const next = [...messages, { role: "user", text: trimmed, display } as LumiMessage];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await askLumi(next, context);
      const withReply: LumiMessage[] = [...next, { role: "assistant", text: reply }];
      setMessages(withReply);
      if (canPersist) void saveLumiHistory(user!.uid, contextKey, withReply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setLoading(false);
    }
  }

  // A contextual reader action ("Explique", "O que significa?", etc.)
  // should feel like an answer, not like a prefilled chatbot. The prompt is
  // sent once per selection/action after that book's saved thread is ready.
  useEffect(() => {
    if (!open) {
      autoPromptRef.current = null;
      return;
    }
    const prompt = context?.initialPrompt?.trim();
    if (!historyLoaded || !prompt) return;
    const key = `${contextKey}:${prompt}`;
    if (autoPromptRef.current === key) return;
    autoPromptRef.current = key;
    const quote = context?.selectedText?.trim();
    void send(
      prompt,
      quote ? `“${quote.length > 160 ? `${quote.slice(0, 160)}…` : quote}”` : undefined,
    );
    // `send` is intentionally excluded: its identity changes every render,
    // while this effect is keyed to a newly opened contextual action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, historyLoaded, context?.initialPrompt, contextKey]);

  async function handleClear() {
    const fresh = [greeting(context ?? null)];
    setMessages(fresh);
    if (canPersist) {
      try {
        await clearLumiHistory(user!.uid, contextKey);
      } catch (err) {
        console.warn("[lumi] failed to clear history", err);
      }
    }
  }

  const subtitle = context?.positionLabel
    ? `sem spoilers além de ${context.positionLabel.toLowerCase()}`
    : context?.bookTitle
      ? context.bookTitle
      : "sua companhia de leitura";
  const fresh = messages.length <= 1 && !loading;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center lg:items-stretch lg:justify-end">
          <motion.button
            type="button"
            aria-label="Fechar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLumiPanel}
            className="absolute inset-0 cursor-default bg-black/35 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-label="Lumi"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={(_, i) => (i.offset.y > 100 || i.velocity.y > 600) && closeLumiPanel()}
            className="relative flex max-h-[86dvh] w-full max-w-lg flex-col rounded-t-[30px] bg-card shadow-2xl lg:h-full lg:max-h-none lg:max-w-md lg:rounded-none lg:rounded-l-[30px]"
          >
            <div
              className="flex cursor-grab touch-none justify-center pb-1 pt-3 lg:hidden"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <span className="h-[5px] w-10 rounded-full bg-border" />
            </div>
            <div className="flex items-center gap-3 px-5 pb-3 pt-2 lg:pt-6">
              <LumiFace size={46} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[18px] font-bold leading-tight tracking-[-0.01em]">Lumi</p>
                <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>
              </div>
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Limpar conversa"
                  title="Limpar conversa"
                  className="press grid h-9 w-9 place-items-center rounded-full text-faint hover:bg-surface-2"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={closeLumiPanel}
                aria-label="Fechar painel da Lumi"
                className="press grid h-10 w-10 place-items-center rounded-full hover:bg-surface-2"
              >
                <X className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </div>

            <div
              ref={scrollRef}
              className="min-h-[120px] flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-2"
            >
              {!historyLoaded ? (
                <TypingDots />
              ) : (
                messages.map((m, i) =>
                  m.role === "user" ? (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-end"
                    >
                      <p className="max-w-[82%] rounded-[20px] rounded-br-[6px] bg-foreground px-4 py-2.5 text-[15px] leading-relaxed text-background">
                        {m.display ?? m.text}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={i}
                      data-selectable=""
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-end gap-2.5"
                    >
                      <LumiFace size={32} className="mb-0.5 shrink-0" />
                      <p className="max-w-[86%] whitespace-pre-line rounded-[20px] rounded-bl-[6px] bg-surface-2 px-4 py-3 text-[15.5px] leading-[1.55] text-foreground/90">
                        {m.text}
                      </p>
                    </motion.div>
                  ),
                )
              )}
              {loading && <TypingDots />}
              {error && (
                <p className="rounded-[14px] bg-rose px-3.5 py-2.5 text-[13px] text-[#9a1f45]">
                  {error}
                </p>
              )}
            </div>

            {(fresh || messages.length <= 2) && !loading && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3 pt-1 lg:flex-wrap">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    onClick={() => {
                      if (context?.topic === suggestion.topic) void send(suggestion.text);
                      else
                        openLumiPanel({
                          ...(context ?? {}),
                          topic: suggestion.topic,
                          initialPrompt: suggestion.text,
                        });
                    }}
                    className="press shrink-0 rounded-full bg-surface-2 px-4 py-2.5 text-[14px] font-semibold"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1"
            >
              <div className="flex items-center gap-2 rounded-[22px] bg-surface-2 py-1.5 pl-4 pr-1.5">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pergunte à Lumi…"
                  className="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none placeholder:text-faint"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="Enviar"
                  className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background transition disabled:opacity-30"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-2.5 py-1 text-[14px] text-muted-foreground">
      <LumiFace size={28} eyes="up" />
      <span className="flex gap-1" aria-label="Lumi está pensando">
        {[0, 1, 2].map((i) => (
          <motion.i
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-faint"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
    </div>
  );
}

/** Small floating trigger button — used on the home AI card. */
export function LumiButton({
  label = "Conhecer a IA",
  context,
}: {
  label?: string;
  context?: LumiContext;
}) {
  return (
    <button
      onClick={() => openLumiPanel(context ?? null)}
      className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-foreground/95 py-2 pl-2 pr-5 text-sm font-medium text-background hover:bg-foreground"
    >
      <LumiMascot size={32} blink={false} interactive />
      {label}
    </button>
  );
}
