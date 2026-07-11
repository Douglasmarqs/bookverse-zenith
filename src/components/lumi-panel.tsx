import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import owl from "@/assets/owl-mascot.png";
import { closeLumiPanel, openLumiPanel, useLumiPanelState, type LumiContext } from "@/lib/lumi-panel-store";
import { askLumi, type LumiMessage } from "@/lib/lumi";

const SUGGESTIONS = [
  "Resuma o capítulo até aqui",
  "Explique esse trecho de um jeito simples",
  "Que livro parecido você recomenda?",
  "Qual o contexto histórico desta obra?",
];

export function LumiPanel() {
  const { open, context } = useLumiPanelState();
  const [messages, setMessages] = useState<LumiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          text: context?.bookTitle
            ? `Olá! Estou acompanhando "${context.bookTitle}" com você. Posso resumir, explicar trechos ou dar contexto — o que você gostaria de saber?`
            : "Olá, eu sou a Lumi 🦉 — sua companhia de leitura. Posso resumir capítulos, explicar trechos difíceis ou recomendar livros parecidos. Como posso ajudar?",
        },
      ]);
    }
  }, [open, context, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    const next = [...messages, { role: "user", text: trimmed } as LumiMessage];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await askLumi(next, context);
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm">
      <button
        aria-label="Fechar"
        className="absolute inset-0 cursor-default"
        onClick={closeLumiPanel}
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border/60 bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
          <img src={owl} alt="" className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold">Lumi</p>
            <p className="truncate text-xs text-muted-foreground">
              {context?.bookTitle ? `Lendo: ${context.bookTitle}` : "IA literária"}
            </p>
          </div>
          <button
            onClick={closeLumiPanel}
            aria-label="Fechar painel da Lumi"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-gold text-primary-foreground"
                    : "border border-border/60 bg-card text-foreground"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lumi está pensando…
              </div>
            </div>
          )}
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 px-5 pb-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-foreground/80 hover:border-gold/40 hover:text-gold"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-border/60 px-4 py-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte algo à Lumi…"
            className="flex-1 rounded-full border border-border bg-secondary/30 px-4 py-2.5 text-sm outline-none focus:border-gold/60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Enviar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold text-primary-foreground transition disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
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
      className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground/95 px-5 py-2.5 text-sm font-medium text-background hover:bg-foreground"
    >
      <Sparkles className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
