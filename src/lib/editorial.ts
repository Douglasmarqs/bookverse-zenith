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
  /** Gostos do onboarding (ids de GENRES) com que este livro combina. */
  genres: string[];
}

/** Indicações comentadas (ids conferidos no Gutenberg) — a seleção do
 * Início muda todo dia e segue os gostos de quem lê; veja picksFor(). */
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
    genres: ["classicos-br", "romance"],
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
    genres: ["gotico", "ficcao-cientifica", "filosofia"],
  },
  {
    gutenbergId: 1661,
    title: "As Aventuras de Sherlock Holmes",
    author: "Arthur Conan Doyle",
    lumiNote:
      "Doze contos independentes: perfeito para quem lê em pausas de 20 minutos. Comece por “Um Escândalo na Boêmia” e veja se você percebe a pista antes do Watson.",
    mood: "Investigação leve",
    minutes: 260,
    tags: ["Contos", "Leitura em pausas"],
    genres: ["misterio", "contos"],
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
    genres: ["absurdo", "filosofia", "contos"],
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
    genres: ["romance"],
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
    genres: ["gotico", "misterio"],
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
    genres: ["fantasia", "absurdo"],
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
    genres: ["aventura", "filosofia"],
  },
  {
    gutenbergId: 54829,
    title: "Memórias Póstumas de Brás Cubas",
    author: "Machado de Assis",
    lumiNote:
      "Um defunto-autor que dedica o livro ao verme que primeiro roeu seu cadáver. Capítulos curtíssimos, ironia em cada linha — é o Machado mais moderno.",
    mood: "Ironia do além",
    minutes: 300,
    tags: ["Clássico brasileiro", "Capítulos curtos"],
    genres: ["classicos-br", "absurdo"],
  },
  {
    gutenbergId: 55682,
    title: "Quincas Borba",
    author: "Machado de Assis",
    lumiNote:
      "“Ao vencedor, as batatas.” A filosofia do Humanitismo explica, com crueldade engraçada, por que Rubião vai perder tudo. Leia depois de Brás Cubas.",
    mood: "Sátira da ambição",
    minutes: 330,
    tags: ["Clássico brasileiro", "Sátira"],
    genres: ["classicos-br", "filosofia"],
  },
  {
    gutenbergId: 57001,
    title: "Papéis Avulsos",
    author: "Machado de Assis",
    lumiNote:
      "Abre com “O Alienista”: um médico que interna a cidade inteira em nome da ciência. Os outros contos são igualmente afiados — ótimo para pausas.",
    mood: "Contos certeiros",
    minutes: 210,
    tags: ["Contos", "Inclui O Alienista"],
    genres: ["classicos-br", "contos", "absurdo"],
  },
  {
    gutenbergId: 33056,
    title: "Histórias sem Data",
    author: "Machado de Assis",
    lumiNote:
      "Contos curtos em que Machado observa vaidades miúdas com lupa. “A Igreja do Diabo” sozinha já vale a leitura.",
    mood: "Vaidades humanas",
    minutes: 180,
    tags: ["Contos", "Leitura em pausas"],
    genres: ["classicos-br", "contos"],
  },
  {
    gutenbergId: 53101,
    title: "A Mão e a Luva",
    author: "Machado de Assis",
    lumiNote:
      "O Machado jovem, ainda romântico, mas já desconfiado: Guiomar escolhe marido como quem escolhe a luva certa. Curto e elegante.",
    mood: "Escolhas do coração",
    minutes: 160,
    tags: ["Clássico brasileiro", "Curto"],
    genres: ["classicos-br", "romance"],
  },
  {
    gutenbergId: 67740,
    title: "Iracema",
    author: "José de Alencar",
    lumiNote:
      "Prosa que quer ser poema: “Iracema, a virgem dos lábios de mel”. Leia devagar, quase em voz alta — o ritmo é a graça do livro.",
    mood: "Lenda e lirismo",
    minutes: 140,
    tags: ["Clássico brasileiro", "Prosa poética"],
    genres: ["classicos-br", "romance", "poesia"],
  },
  {
    gutenbergId: 38496,
    title: "Ubirajara",
    author: "José de Alencar",
    lumiNote:
      "Alencar imagina o Brasil antes dos portugueses, com guerreiros, provas e alianças. Mais aventura do que você espera de um clássico escolar.",
    mood: "Épico indígena",
    minutes: 130,
    tags: ["Clássico brasileiro", "Aventura"],
    genres: ["classicos-br", "aventura", "historia"],
  },
  {
    gutenbergId: 44540,
    title: "Cinco Minutos",
    author: "José de Alencar",
    lumiNote:
      "Um romance inteiro que nasce de um atraso de cinco minutos no ônibus. Cabe numa noite e mostra o Alencar mais leve.",
    mood: "Romance relâmpago",
    minutes: 60,
    tags: ["Curto", "Comece hoje"],
    genres: ["classicos-br", "romance"],
  },
  {
    gutenbergId: 3333,
    title: "Os Lusíadas",
    author: "Luís de Camões",
    lumiNote:
      "Dez cantos sobre a viagem de Vasco da Gama. Comece pelo episódio do Gigante Adamastor (Canto V) e depois volte ao início.",
    mood: "Epopeia do mar",
    minutes: 420,
    tags: ["Poesia", "Epopeia"],
    genres: ["poesia", "aventura", "historia"],
  },
  {
    gutenbergId: 16425,
    title: "Amor de Perdição",
    author: "Camilo Castelo Branco",
    lumiNote:
      "Romeu e Julieta à portuguesa, escrito em quinze dias numa prisão. Exagerado, trágico e impossível de largar.",
    mood: "Paixão trágica",
    minutes: 230,
    tags: ["Romance", "Portugal"],
    genres: ["romance"],
  },
  {
    gutenbergId: 31971,
    title: "O Crime do Padre Amaro",
    author: "Eça de Queirós",
    lumiNote:
      "Eça desmonta a hipocrisia de uma cidade pequena com ironia cirúrgica. Um dos romances mais corajosos da língua portuguesa.",
    mood: "Escândalo e ironia",
    minutes: 560,
    tags: ["Realismo", "Portugal"],
    genres: ["romance", "historia"],
  },
  {
    gutenbergId: 174,
    title: "O Retrato de Dorian Gray",
    author: "Oscar Wilde",
    lumiNote:
      "Cada frase de Lord Henry é um aforismo pronto para citar — e uma armadilha. Repare em quem envelhece de verdade nesta história.",
    mood: "Beleza e culpa",
    minutes: 300,
    tags: ["Clássico", "Aforismos"],
    genres: ["gotico", "filosofia"],
  },
  {
    gutenbergId: 43,
    title: "O Médico e o Monstro",
    author: "Robert Louis Stevenson",
    lumiNote:
      "Curtíssimo e tenso: o mistério está todo em quem conta a história, não no monstro. Cabe numa noite.",
    mood: "Duplo sombrio",
    minutes: 110,
    tags: ["Curto", "Suspense"],
    genres: ["gotico", "misterio"],
  },
  {
    gutenbergId: 35,
    title: "A Máquina do Tempo",
    author: "H. G. Wells",
    lumiNote:
      "Wells inventa a viagem no tempo para falar de desigualdade social. O futuro dos Elóis e Morlocks é uma metáfora que não envelheceu.",
    mood: "Futuro inquietante",
    minutes: 140,
    tags: ["Ficção científica", "Curto"],
    genres: ["ficcao-cientifica", "aventura"],
  },
  {
    gutenbergId: 36,
    title: "A Guerra dos Mundos",
    author: "H. G. Wells",
    lumiNote:
      "A invasão marciana narrada como reportagem. Repare como o livro desconfia do orgulho humano — e no final, quem salva a Terra.",
    mood: "Invasão e pânico",
    minutes: 250,
    tags: ["Ficção científica", "Clássico"],
    genres: ["ficcao-cientifica", "aventura"],
  },
  {
    gutenbergId: 120,
    title: "A Ilha do Tesouro",
    author: "Robert Louis Stevenson",
    lumiNote:
      "Mapas, papagaio e Long John Silver — o pirata mais ambíguo da literatura. Aventura pura, do jeito que inventou o gênero.",
    mood: "Piratas e mapas",
    minutes: 280,
    tags: ["Aventura", "Clássico"],
    genres: ["aventura"],
  },
  {
    gutenbergId: 164,
    title: "Vinte Mil Léguas Submarinas",
    author: "Jules Verne",
    lumiNote:
      "O capitão Nemo é o anfitrião mais misterioso do fundo do mar. Pule as listas de peixes sem culpa se quiser — a viagem continua incrível.",
    mood: "Mistério submarino",
    minutes: 480,
    tags: ["Aventura", "Ficção científica"],
    genres: ["aventura", "ficcao-cientifica"],
  },
  {
    gutenbergId: 103,
    title: "A Volta ao Mundo em 80 Dias",
    author: "Jules Verne",
    lumiNote:
      "Uma aposta, um relógio e um mordomo atrapalhado. Fique atento ao fuso horário: o desfecho depende dele.",
    mood: "Corrida contra o tempo",
    minutes: 290,
    tags: ["Aventura", "Leve"],
    genres: ["aventura"],
  },
  {
    gutenbergId: 2852,
    title: "O Cão dos Baskervilles",
    author: "Arthur Conan Doyle",
    lumiNote:
      "O caso mais famoso de Holmes, com pântano, neblina e uma lenda de família. Mistério e terror gótico na mesma medida.",
    mood: "Mistério no pântano",
    minutes: 240,
    tags: ["Mistério", "Clássico"],
    genres: ["misterio", "gotico"],
  },
  {
    gutenbergId: 1260,
    title: "Jane Eyre",
    author: "Charlotte Brontë",
    lumiNote:
      "Uma governanta que se recusa a ser menos do que é. A voz de Jane, em primeira pessoa, soa surpreendentemente moderna.",
    mood: "Independência e mistério",
    minutes: 720,
    tags: ["Romance", "Gótico"],
    genres: ["romance", "gotico"],
  },
  {
    gutenbergId: 768,
    title: "O Morro dos Ventos Uivantes",
    author: "Emily Brontë",
    lumiNote:
      "Nada de romance açucarado: é obsessão, vingança e charneca. Anote a árvore genealógica — os nomes se repetem de propósito.",
    mood: "Paixão selvagem",
    minutes: 480,
    tags: ["Romance", "Gótico"],
    genres: ["romance", "gotico"],
  },
  {
    gutenbergId: 64317,
    title: "O Grande Gatsby",
    author: "F. Scott Fitzgerald",
    lumiNote:
      "Curto, brilhante e triste. Preste atenção à luz verde no fim do cais — é o livro inteiro em uma imagem.",
    mood: "Sonho e ilusão",
    minutes: 180,
    tags: ["Clássico", "Curto"],
    genres: ["romance"],
  },
  {
    gutenbergId: 1952,
    title: "O Papel de Parede Amarelo",
    author: "Charlotte Perkins Gilman",
    lumiNote:
      "Um conto que começa como diário e termina como pesadelo. Leia de uma vez só — dura menos que um episódio de série.",
    mood: "Inquietação crescente",
    minutes: 40,
    tags: ["Conto", "Comece hoje"],
    genres: ["gotico", "contos"],
  },
  {
    gutenbergId: 219,
    title: "O Coração das Trevas",
    author: "Joseph Conrad",
    lumiNote:
      "Uma viagem rio acima que vai ficando mais escura a cada página. Denso, mas curto — e inspirou Apocalypse Now.",
    mood: "Viagem sombria",
    minutes: 150,
    tags: ["Curto", "Clássico"],
    genres: ["aventura", "filosofia"],
  },
  {
    gutenbergId: 16,
    title: "Peter Pan",
    author: "J. M. Barrie",
    lumiNote:
      "Mais melancólico do que o desenho: é um livro sobre crescer e o que se perde nisso. Leia como adulto.",
    mood: "Infância eterna",
    minutes: 200,
    tags: ["Fantasia", "Leve"],
    genres: ["fantasia", "aventura"],
  },
  {
    gutenbergId: 55,
    title: "O Mágico de Oz",
    author: "L. Frank Baum",
    lumiNote:
      "Os sapatos são de prata, não de rubi — e há muito mais aventuras que no filme. Ótimo para ler em voz alta.",
    mood: "Estrada de tijolos",
    minutes: 160,
    tags: ["Fantasia", "Leve"],
    genres: ["fantasia", "aventura"],
  },
  {
    gutenbergId: 1232,
    title: "O Príncipe",
    author: "Nicolau Maquiavel",
    lumiNote:
      "Curto e direto: um manual de poder escrito para ser útil, não bonito. Leia um capítulo por dia e discorde à vontade.",
    mood: "Poder sem rodeios",
    minutes: 140,
    tags: ["Filosofia", "Curto"],
    genres: ["filosofia", "historia"],
  },
  {
    gutenbergId: 2680,
    title: "Meditações",
    author: "Marco Aurélio",
    lumiNote:
      "Anotações pessoais de um imperador para si mesmo. Abra em qualquer página: cada trecho funciona sozinho.",
    mood: "Calma estoica",
    minutes: 230,
    tags: ["Filosofia", "Leitura em pausas"],
    genres: ["filosofia"],
  },
  {
    gutenbergId: 132,
    title: "A Arte da Guerra",
    author: "Sun Tzu",
    lumiNote:
      "Treze capítulos curtíssimos sobre estratégia — e quase todos servem para a vida fora da guerra.",
    mood: "Estratégia antiga",
    minutes: 80,
    tags: ["Filosofia", "Curto"],
    genres: ["filosofia", "historia"],
  },
  {
    gutenbergId: 2554,
    title: "Crime e Castigo",
    author: "Fiódor Dostoiévski",
    lumiNote:
      "O crime acontece cedo; o livro é sobre o que ele faz com a cabeça de Raskólnikov. Um thriller psicológico antes do termo existir.",
    mood: "Culpa febril",
    minutes: 900,
    tags: ["Clássico", "Projeto longo"],
    genres: ["filosofia", "misterio"],
  },
  {
    gutenbergId: 996,
    title: "Dom Quixote",
    author: "Miguel de Cervantes",
    lumiNote:
      "O primeiro romance moderno e ainda um dos mais engraçados. Leia em episódios — cada aventura funciona quase sozinha.",
    mood: "Loucura e humor",
    minutes: 1300,
    tags: ["Projeto longo", "Humor"],
    genres: ["aventura", "absurdo"],
  },
  {
    gutenbergId: 1727,
    title: "A Odisseia",
    author: "Homero",
    lumiNote:
      "A volta para casa mais longa da literatura: ciclopes, sereias e uma esposa mais esperta que todos os pretendentes.",
    mood: "Viagem épica",
    minutes: 500,
    tags: ["Epopeia", "Clássico"],
    genres: ["aventura", "fantasia", "poesia"],
  },
  {
    gutenbergId: 8800,
    title: "A Divina Comédia",
    author: "Dante Alighieri",
    lumiNote:
      "Comece pelo Inferno e use as notas sem culpa. Cada canto é curto — um por noite é um ótimo ritmo.",
    mood: "Viagem pelo além",
    minutes: 700,
    tags: ["Poesia", "Projeto longo"],
    genres: ["poesia", "filosofia"],
  },
  {
    gutenbergId: 2148,
    title: "Contos de Edgar Allan Poe",
    author: "Edgar Allan Poe",
    lumiNote:
      "Inclui “O Barril de Amontillado” e “A Queda da Casa de Usher”. Leia à noite, um conto por vez.",
    mood: "Terror elegante",
    minutes: 300,
    tags: ["Contos", "Terror"],
    genres: ["gotico", "misterio", "contos"],
  },
  {
    gutenbergId: 41,
    title: "A Lenda do Cavaleiro sem Cabeça",
    author: "Washington Irving",
    lumiNote:
      "Uma história de fantasma com mais humor do que você espera. Curta, perfeita para outubro.",
    mood: "Assombração leve",
    minutes: 50,
    tags: ["Conto", "Comece hoje"],
    genres: ["gotico", "contos"],
  },
  {
    gutenbergId: 1524,
    title: "Hamlet",
    author: "William Shakespeare",
    lumiNote:
      "Leia uma cena por vez e imagine os atores. As frases famosas aparecem onde você menos espera.",
    mood: "Dúvida real",
    minutes: 200,
    tags: ["Teatro", "Clássico"],
    genres: ["filosofia", "poesia"],
  },
  {
    gutenbergId: 1513,
    title: "Romeu e Julieta",
    author: "William Shakespeare",
    lumiNote:
      "Tudo acontece em quatro dias. Repare como o humor da primeira metade torna o final ainda mais duro.",
    mood: "Amor urgente",
    minutes: 160,
    tags: ["Teatro", "Romance"],
    genres: ["romance", "poesia"],
  },
  {
    gutenbergId: 1322,
    title: "Folhas de Relva",
    author: "Walt Whitman",
    lumiNote:
      "Poesia que respira fundo. Abra em “Song of Myself” e leia em voz alta — os versos longos foram feitos para isso.",
    mood: "Celebração do mundo",
    minutes: 400,
    tags: ["Poesia", "Leitura em pausas"],
    genres: ["poesia"],
  },
  {
    gutenbergId: 2542,
    title: "Casa de Bonecas",
    author: "Henrik Ibsen",
    lumiNote:
      "Uma peça curta cujo final escandalizou a Europa. Leia de uma vez e pense no som daquela porta.",
    mood: "Liberdade em cena",
    minutes: 120,
    tags: ["Teatro", "Curto"],
    genres: ["filosofia", "romance"],
  },
  {
    gutenbergId: 205,
    title: "Walden",
    author: "Henry David Thoreau",
    lumiNote:
      "Dois anos numa cabana para descobrir o que é essencial. Leia aos poucos, de preferência longe do celular.",
    mood: "Vida simples",
    minutes: 450,
    tags: ["Filosofia", "Natureza"],
    genres: ["filosofia"],
  },
  {
    gutenbergId: 74,
    title: "As Aventuras de Tom Sawyer",
    author: "Mark Twain",
    lumiNote:
      "Travessuras, uma caverna e um tesouro. Twain escreve infância sem açúcar e com muito humor.",
    mood: "Travessura e rio",
    minutes: 270,
    tags: ["Aventura", "Leve"],
    genres: ["aventura"],
  },
];

/** Dia corrido desde 1970 (no fuso do aparelho) — muda a seleção à meia-noite. */
export function dayIndex(date = new Date()): number {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);
}

/** Hash pequeno e estável (para embaralhar igual o dia inteiro). */
function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

/**
 * Seleção do dia: prioriza os gostos escolhidos, tira o que já está na
 * estante e embaralha de forma estável por dia (e por "shuffle", quando a
 * pessoa pede outra rodada). Sempre mistura alguns fora dos gostos para
 * ninguém ficar preso numa bolha.
 */
export function picksFor({
  genres = [],
  exclude = [],
  count = 12,
  day = dayIndex(),
  shuffle = 0,
}: {
  genres?: string[];
  exclude?: string[];
  count?: number;
  day?: number;
  shuffle?: number;
} = {}): LumiPick[] {
  const skip = new Set(exclude.map((t) => t.trim().toLowerCase()));
  const liked = new Set(genres);
  const seed = day * 131 + shuffle * 7919;
  const scored = LUMI_PICKS.filter((p) => !skip.has(p.title.toLowerCase())).map((p) => {
    const match = p.genres.filter((g) => liked.has(g)).length;
    const noise = hash(seed + p.gutenbergId) % 1000;
    return { p, match, noise };
  });
  const ranked = scored.sort((a, b) => b.noise - a.noise);
  if (!liked.size) return ranked.slice(0, count).map((x) => x.p);
  const fits = ranked.filter((x) => x.match > 0);
  const others = ranked.filter((x) => x.match === 0);
  // ~3 em cada 4 combinam com os gostos; o resto é descoberta.
  const out: LumiPick[] = [];
  while (out.length < count && (fits.length || others.length)) {
    const takeOther = out.length % 4 === 3 || !fits.length;
    const next = (takeOther ? others.shift() : fits.shift()) ?? fits.shift() ?? others.shift();
    if (next) out.push(next.p);
  }
  return out;
}

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
