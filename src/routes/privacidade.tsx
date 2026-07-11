import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Privacidade — BookVerse" }] }),
  component: () => (
    <div className="mx-auto max-w-3xl px-5 py-16 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Privacidade</p>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Política de privacidade</h1>
      <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
        <p>
          Guardamos apenas o necessário para o funcionamento do BookVerse: dados de conta (nome,
          e-mail, foto de perfil), progresso de leitura, biblioteca pessoal e XP de ranking. Esses
          dados ficam no Firebase (Auth + Firestore) e são visíveis apenas a você — com exceção do
          nome, foto e XP, que aparecem publicamente no ranking.
        </p>
        <p>
          Conversas com a Lumi (IA) são enviadas ao provedor do modelo de linguagem apenas para
          gerar a resposta e não são usadas para treinar modelos de terceiros.
        </p>
        <p>Você pode pedir a exclusão da sua conta e dos seus dados a qualquer momento pelo contato.</p>
      </div>
    </div>
  ),
});
