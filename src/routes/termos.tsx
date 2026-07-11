import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de uso — BookVerse" }] }),
  component: () => (
    <div className="mx-auto max-w-3xl px-5 py-16 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.28em] text-gold">Termos</p>
      <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">Termos de uso</h1>
      <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
        <p>
          Ao usar o BookVerse você concorda em não abusar do serviço (spam, automação maliciosa,
          tentativas de burlar limites de uso da IA) e em manter suas credenciais de acesso em
          segurança.
        </p>
        <p>
          O conteúdo de amostra disponível no leitor é apenas para fins de demonstração da
          experiência de leitura; livros de catálogo externo (buscados via Google Books) pertencem
          aos seus respectivos autores e editoras.
        </p>
        <p>Este é um projeto em evolução — funcionalidades podem mudar sem aviso prévio.</p>
      </div>
    </div>
  ),
});
