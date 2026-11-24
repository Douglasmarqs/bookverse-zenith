/** Single source of truth for the app's navigation destinations. */
export const DISCOVER_SEARCH = { q: undefined, categoria: undefined } as const;

export const MEMBER_NAV = [
  { label: "Início", to: "/" },
  { label: "Descobrir", to: "/descobrir" },
  { label: "Biblioteca", to: "/biblioteca" },
  { label: "Diário", to: "/diario" },
] as const;

export const PROGRESS_NAV = [
  { label: "Metas", to: "/metas", description: "Sua meta anual de livros" },
  { label: "Desafios", to: "/desafios", description: "Missões semanais e conquistas" },
  { label: "Ranking", to: "/ranking", description: "Leitores mais ativos" },
] as const;

export const VISITOR_NAV = [
  { label: "Recursos", hash: "recursos" },
  { label: "Como funciona", hash: "como-funciona" },
  { label: "Lumi", hash: "lumi" },
  { label: "Dúvidas", hash: "faq" },
] as const;
