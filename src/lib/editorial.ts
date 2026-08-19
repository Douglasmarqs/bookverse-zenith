/**
 * Editorial layer for the Descobrir page — curadoria própria do BookVerse.
 *
 * Tudo aqui é conteúdo estático (zero rede, zero custo de carregamento):
 * indicações comentadas pela Lumi, curiosidades literárias, rituais de
 * leitura e trilhas/desafios temáticos. Os livros indicados são de domínio
 * público e abrem direto no leitor via id do Project Gutenberg.
 */

export interface LumiPick {
  /** Project Gutenberg id — abre no leitor via gutenbergReaderId(). */
  gutenbergId: number;
  title: string;
  author: string;
  /** Comentário curto, em primeira pessoa, da Lumi. */
  lumiNote: string;
  mood: string;
  minutes: number;
  tags: string[];
}

/** Indicações comentadas — rotacionam por semana do ano. */
export const LUMI_PICKS: LumiPick[] = [
  {
    gutenbergId: 55752,
    title: "Dom Casmurro",
    author: "Machado de Assis",
    lumiNote:
      "Machado te entrega um narrador que quer ganhar a discussão antes de você notar que existe uma. Leia desconfiando de cada adjetivo — é aí que o livro acontece.",
    mood: "Ciúme e memória",
    minutes: 380,
    tags: ["Clássico brasileiro", "Narrador duvidoso"],
  },
  {
    gutenbergId: 84,
    title: "Frankenstein",
    author: "Mary Shelley",
    lumiNote:
      "Escrito por uma autora de 18 anos numa aposta entre amigos. O monstro fala melhor que o criador — e é essa inversão que ainda incomoda dois séculos depois.",
    mood: "Gótico e ético",
    minutes: 330,
    tags: ["Ficção científica", "Origem do gênero"],
  },
  {
    gutenbergId: 1661,
    title: "As Aventuras de Sherlock Holmes",
    author: "Arthur Conan Doyle",
    lumiNote:
      "Doze contos independentes: perfeito para quem lê em pausas de 20 minutos. Comece por “A Escândalo na Boêmia” e veja se você percebe a pista antes do Watson.",
    mood: "Investigação leve",
    minutes: 260,
    tags: ["Contos", "Leitura em pausas"],
  },
  {
    gutenbergId: 5200,
    title: "A Metamorfose",
    author: "Franz Kafka",
    lumiNote:
      "A primeira frase já resolve o susto para gastar o resto do livro no que interessa: a burocracia doméstica do absurdo. Cabe numa tarde.",
    mood: "Absurdo íntimo",
    minutes: 90,
    tags: ["Curto", "Comece hoje"],
  },
  {
    gutenbergId: 1342,
    title: "Orgulho e Preconceito",
    author: "Jane Austen",
    lumiNote:
      "Austen escreve diálogo como esgrima. Marque as falas da Elizabeth — dá um manual involuntário de como discordar com elegância.",
    mood: "Romance afiado",
    minutes: 400,
    tags: ["Diálogo", "Clássico"],
  },
  {
    gutenbergId: 345,
    title: "Drácula",
    author: "Bram Stoker",
    lumiNote:
      "Todo o romance é feito de cartas, diários e recortes de jornal — um dos primeiros “found footage” da literatura. Leia à noite, com o tema sépia.",
    mood: "Terror epistolar",
    minutes: 420,
    tags: ["Terror", "Formato experimental"],
  },
  {
    gutenbergId: 11,
    title: "Alice no País das Maravilhas",
    author: "Lewis Carroll",
    lumiNote:
      "Um matemático brincando com lógica disfarçada de infantilidade. Releia os trechos do Chapeleiro em voz alta: o texto foi feito para o ouvido.",
    mood: "Nonsense luminoso",
    minutes: 150,
    tags: ["Leve", "Releitura"],
  },
  {
    gutenbergId: 2701,
    title: "Moby Dick",
    author: "Herman Melville",
    lumiNote:
      "Não tente ler em maratona. Um capítulo por dia por três meses — é literalmente o ritmo de uma viagem de baleeiro, e o livro recompensa a paciência.",
    mood: "Obsessão oceânica",
    minutes: 900,
    tags: ["Projeto longo", "Desafio"],
  },
];

/** Rotação estável por semana — mesmo conjunto para todos, muda toda semana. */
export function weekIndex(date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / (7 * 24 * 60 * 60 * 1000));
}

export function rotate<T>(items: T[], count: number, offset = weekIndex()): T[] {
  if (items.length === 0) return [];
  return Array.from(
    { length: Math.min(count, items.length) },
    (_, i) => items[(offset + i) % items.length]!,
  );
}

export interface Curiosity {
  text: string;
  source: string;
}

export const CURIOSITIES: Curiosity[] = [
  {
    text: "O EPUB é, por dentro, um zip com HTML e CSS. É por isso que o mesmo livro se ajusta a qualquer tela sem perder a formatação.",
    source: "Formato aberto",
  },
  {
    text: "“Memórias Póstumas de Brás Cubas” saiu primeiro em fascículos de revista — daí os capítulos curtíssimos, feitos para uma leitura por dia.",
    source: "1881",
  },
  {
    text: "Ler 20 minutos por dia soma cerca de 1,8 milhão de palavras por ano — o equivalente a uns 20 romances.",
    source: "Hábito",
  },
  {
    text: "A fonte de um e-reader importa mais que o tamanho: entrelinha de 1,6 reduz a fadiga visual mais do que aumentar a letra.",
    source: "Tipografia",
  },
  {
    text: "Grifar demais atrapalha: estudos de memória mostram que anotar uma frase com suas palavras retém mais que destacar dez.",
    source: "Leitura ativa",
  },
  {
    text: "O tema sépia funciona porque reduz o contraste azul da tela, o que interfere menos na melatonina antes de dormir.",
    source: "Leitura noturna",
  },
];

export interface Ritual {
  title: string;
  body: string;
}

export const RITUALS: Ritual[] = [
  {
    title: "Regra dos 25 minutos",
    body: "Um bloco só de leitura, celular longe. É o suficiente para entrar no livro e curto o bastante para não virar dever.",
  },
  {
    title: "Duas páginas obrigatórias",
    body: "Nos dias ruins, leia duas páginas e pare. A sequência sobrevive — e ela é o que constrói o hábito, não o volume.",
  },
  {
    title: "Uma nota por capítulo",
    body: "Ao fechar o capítulo, escreva uma frase no leitor. Em um mês você tem um resumo do livro escrito por você.",
  },
  {
    title: "Livro longo + livro curto",
    body: "Mantenha um projeto grande e um de contos ao lado. Quando o grande pesa, o curto mantém o ritmo.",
  },
];

export interface ReadingTrack {
  id: string;
  title: string;
  description: string;
  /** Quantos livros terminados a trilha pede. */
  goal: number;
  xp: number;
  /** Busca sugerida na página Descobrir. */
  query: string;
}

/** Trilhas temáticas — desafios com tema, não só números. */
export const READING_TRACKS: ReadingTrack[] = [
  {
    id: "track-gotico",
    title: "Outubro gótico",
    description: "Três clássicos de terror: Drácula, Frankenstein e contos de Poe.",
    goal: 3,
    xp: 150,
    query: "gothic horror",
  },
  {
    id: "track-brasil",
    title: "Volta ao Brasil literário",
    description: "Machado, Alencar e Lima Barreto — o realismo brasileiro em domínio público.",
    goal: 3,
    xp: 180,
    query: "Machado de Assis",
  },
  {
    id: "track-contos",
    title: "Semana de contos",
    description: "Cinco contos curtos em sete dias. Ideal para reacender a sequência.",
    goal: 1,
    xp: 60,
    query: "short stories",
  },
  {
    id: "track-maratona",
    title: "Maratona de baleia",
    description: "Encare um romance longo (600+ páginas) do começo ao fim.",
    goal: 1,
    xp: 200,
    query: "Moby Dick",
  },
];

/**
 * Canal/chat da comunidade no Telegram. Assim que o link do canal for
 * informado, basta preenchê-lo aqui e o card vira um convite ativo.
 */
export const TELEGRAM_CHANNEL_URL: string | null = "https://t.me/livros_em_epub";
