import { Link } from "@tanstack/react-router";
import { BookOpen, Check, Sparkles, UploadCloud, X } from "lucide-react";
import { useState } from "react";

const ONBOARDING_KEY = "bookverse:onboarding:complete:v1";

/** A deliberately small first-use guide. It is local to the browser so it
 * never blocks a first login while Firestore is offline, and it can be
 * dismissed permanently by the reader. */
export function OnboardingCard() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) === "1";
    } catch {
      return false;
    }
  });

  function dismiss() {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // The card can still be dismissed for this visit in private mode.
    }
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <section className="mt-10 rounded-3xl border border-gold/25 bg-gold/5 p-5 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            <Sparkles className="h-3.5 w-3.5" /> Primeiros passos
          </p>
          <h2 className="mt-2 font-display text-2xl font-medium">
            Seu canto de leitura está pronto.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Escolha uma leitura disponível, importe um arquivo que você possui e retome de onde
            parou — mesmo se ficar sem conexão por um tempo.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar guia de primeiros passos"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Step
          icon={<BookOpen className="h-4 w-4" />}
          title="1. Descubra"
          text="Salve uma obra ou abra uma leitura pública."
        />
        <Step
          icon={<UploadCloud className="h-4 w-4" />}
          title="2. Traga seus arquivos"
          text="EPUB e PDF ficam vinculados somente à sua conta."
        />
        <Step
          icon={<Check className="h-4 w-4" />}
          title="3. Leia do seu jeito"
          text="Ajuste o leitor e use a Lumi para revisar."
        />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          to="/descobrir"
          className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Explorar livros
        </Link>
        <Link
          to="/biblioteca"
          className="rounded-full border border-border bg-background/50 px-4 py-2 text-sm font-semibold text-foreground"
        >
          Abrir biblioteca
        </Link>
        <button
          onClick={dismiss}
          className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Já entendi
        </button>
      </div>
    </section>
  );
}

function Step({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <div className="flex items-center gap-2 text-gold">
        {icon}
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
