import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sobre")({
  head: () => ({ meta: [{ title: "Sobre — BookVerse" }] }),
  component: () => (
    <div className="mx-auto max-w-3xl px-5 py-16 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Sobre</p>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">O que é o BookVerse</h1>
      <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
        <p>
          BookVerse é uma biblioteca digital pensada para leitores exigentes: um leitor imersivo,
          progresso sincronizado entre dispositivos, uma companhia de leitura com IA (a Lumi) e um
          ranking para quem gosta de transformar leitura em hábito com metas.
        </p>
        <p>
          O projeto está em desenvolvimento contínuo — novas funcionalidades chegam com frequência
          conforme a biblioteca de títulos e a experiência de leitura evoluem.
        </p>
      </div>
    </div>
  ),
});
