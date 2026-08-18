import { useEffect, useState } from "react";
import { Quote } from "lucide-react";

/** Small rotating literary curiosity — pure static content, no network,
 * so it never contributes to load time. */
const FACTS: { text: string; source: string }[] = [
  {
    text: "O primeiro livro impresso com tipos móveis na Europa, a Bíblia de Gutenberg, levou cerca de três anos para ficar pronto.",
    source: "1455",
  },
  {
    text: "Machado de Assis escreveu “Memórias Póstumas de Brás Cubas” em capítulos curtos porque o romance saiu primeiro em fascículos de revista.",
    source: "1881",
  },
  {
    text: "O formato EPUB é, por dentro, apenas um arquivo zip com HTML — é por isso que um mesmo livro se adapta a qualquer tela.",
    source: "Formato aberto",
  },
  {
    text: "Ler 20 minutos por dia soma mais de 1,8 milhão de palavras por ano.",
    source: "Hábito",
  },
  {
    text: "Clarice Lispector dizia escrever “com o corpo todo” — e revisava cada frase em voz alta.",
    source: "Ofício",
  },
];

export function LiteraryFactCard({ className = "" }: { className?: string }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(Math.floor(Math.random() * FACTS.length));
    const t = setInterval(() => setI((n) => (n + 1) % FACTS.length), 12000);
    return () => clearInterval(t);
  }, []);

  const fact = FACTS[i] ?? FACTS[0]!;

  return (
    <div
      className={`rounded-2xl border border-border/60 bg-card/50 p-5 backdrop-blur ${className}`}
    >
      <Quote className="h-4 w-4 text-gold" />
      <p className="mt-3 text-sm leading-relaxed text-foreground/85">{fact.text}</p>
      <p className="mt-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {fact.source}
      </p>
    </div>
  );
}
