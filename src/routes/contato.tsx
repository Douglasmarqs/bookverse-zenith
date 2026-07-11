import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/contato")({
  head: () => ({ meta: [{ title: "Contato — BookVerse" }] }),
  component: () => (
    <div className="mx-auto max-w-3xl px-5 py-16 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Contato</p>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Fale com a gente</h1>
      <p className="mt-6 max-w-lg text-muted-foreground leading-relaxed">
        Dúvidas, sugestões ou problemas técnicos? Mande um e-mail — respondemos o quanto antes.
      </p>
      <a
        href="mailto:contato@bookverse.online"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-medium text-primary-foreground"
      >
        <Mail className="h-4 w-4" /> contato@bookverse.online
      </a>
    </div>
  ),
});
