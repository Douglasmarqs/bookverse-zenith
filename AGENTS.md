# BookVerse — notas para agentes e colaboradores

- Stack: TanStack Start (React 19) + Vite + Tailwind v4, Firebase (Auth,
  Firestore, Storage, Cloud Functions) e Nitro para o servidor.
- O build é configurado diretamente em `vite.config.ts` (sem wrappers de
  plataforma). Nitro detecta o provedor de hospedagem automaticamente.
- Antes de enviar: `npx tsc --noEmit`, `npm run lint` e `npm run build`
  precisam passar.
- Não reescreva histórico já publicado (force push, rebase de commits
  enviados).
