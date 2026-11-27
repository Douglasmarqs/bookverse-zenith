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
  /** Idioma da edição que abre (a do Gutenberg). */
  lang: "pt" | "en";
}

/** Edições em português entre as indicações (as demais estão em inglês). */
const PT_EDITIONS = new Set([
  55752, 54829, 55682, 57001, 33056, 53101, 67740, 38496, 44540, 3333, 16425, 31971,
  // Ampliação: mais clássicos brasileiros e portugueses.
  56737, 55797, 67162, 67780, 67935, 61653, 67724, 67831, 69187, 67535, 74475, 68635, 74854, 67594,
  18082, 16384, 17515, 18220, 40409, 42942, 31347, 20574, 24401, 17591, 45966, 9654, 29120, 17610,
  20142, 8698,
]);

/** Indicações comentadas (ids conferidos no Gutenberg) — a seleção do
 * Início muda todo dia e segue os gostos de quem lê; veja picksFor(). */
const PICKS: Omit<LumiPick, "lang">[] = [
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
  // — Mais clássicos em português (ids e downloads conferidos) —
  {
    gutenbergId: 56737,
    title: "Esaú e Jacó",
    author: "Machado de Assis",
    lumiNote:
      "Gêmeos que discordam desde o útero — um monarquista, outro republicano — e apaixonados pela mesma moça. O Brasil virando República visto da sala de jantar.",
    mood: "Rivalidade e política",
    minutes: 320,
    tags: ["Clássico brasileiro", "República"],
    genres: ["classicos-br", "romance", "historia"],
  },
  {
    gutenbergId: 55797,
    title: "Memorial de Aires",
    author: "Machado de Assis",
    lumiNote:
      "O último romance de Machado, em forma de diário de um diplomata aposentado. Calmo, terno e cheio de ironia miúda — ótimo para ler devagar, uma entrada por noite.",
    mood: "Diário sereno",
    minutes: 230,
    tags: ["Diário", "Último romance"],
    genres: ["classicos-br", "romance"],
  },
  {
    gutenbergId: 67162,
    title: "Helena",
    author: "Machado de Assis",
    lumiNote:
      "Um testamento revela uma filha que ninguém conhecia, e a casa inteira muda de temperatura. Machado jovem, mais romântico, mas já desconfiado das aparências.",
    mood: "Segredo de família",
    minutes: 250,
    tags: ["Clássico brasileiro", "Romantismo"],
    genres: ["classicos-br", "romance"],
  },
  {
    gutenbergId: 67780,
    title: "Iaiá Garcia",
    author: "Machado de Assis",
    lumiNote:
      "Orgulho, guerra do Paraguai e um casamento por conveniência. Repare em Estela: é uma das personagens mais dignas e silenciosas de todo o Machado.",
    mood: "Orgulho contido",
    minutes: 250,
    tags: ["Clássico brasileiro", "Romance"],
    genres: ["classicos-br", "romance"],
  },
  {
    gutenbergId: 67935,
    title: "Relíquias de Casa Velha",
    author: "Machado de Assis",
    lumiNote:
      "Abre com o soneto “A Carolina” e traz “Pai contra Mãe”, um dos contos mais duros sobre a escravidão. Contos curtos, para ler um por vez e ficar pensando.",
    mood: "Contos maduros",
    minutes: 220,
    tags: ["Contos", "Leitura em pausas"],
    genres: ["classicos-br", "contos"],
  },
  {
    gutenbergId: 61653,
    title: "Poesias Completas",
    author: "Machado de Assis",
    lumiNote:
      "Pouca gente sabe que Machado começou como poeta. Leia aos poucos, abrindo em qualquer página — dá para ver o romancista afiando a ironia em versos.",
    mood: "Versos de um prosador",
    minutes: 200,
    tags: ["Poesia", "Abra em qualquer página"],
    genres: ["classicos-br", "poesia"],
  },
  {
    gutenbergId: 67724,
    title: "O Guarani (vol. 1)",
    author: "José de Alencar",
    lumiNote:
      "Peri, Ceci e um casarão à beira do Paquequer: aventura indianista com cenas de cinema. Este é o primeiro de dois volumes — a busca encontra o segundo.",
    mood: "Aventura romântica",
    minutes: 260,
    tags: ["Indianismo", "Vol. 1 de 2"],
    genres: ["classicos-br", "aventura", "romance"],
  },
  {
    gutenbergId: 67831,
    title: "A Pata da Gazela",
    author: "José de Alencar",
    lumiNote:
      "Um rapaz se apaixona por um pé — literalmente — antes de conhecer a dona. Alencar em modo leve e divertido, quase uma comédia romântica do século XIX.",
    mood: "Comédia de costumes",
    minutes: 160,
    tags: ["Romance urbano", "Leve"],
    genres: ["classicos-br", "romance"],
  },
  {
    gutenbergId: 69187,
    title: "O Cortiço",
    author: "Aluísio Azevedo",
    lumiNote:
      "O cortiço é o verdadeiro protagonista: respira, briga, cresce. Naturalismo puro, barulhento e cheio de cheiro — o Rio de Janeiro que os salões fingiam não ver.",
    mood: "Coletivo e cru",
    minutes: 360,
    tags: ["Naturalismo", "Rio de Janeiro"],
    genres: ["classicos-br", "romance", "historia"],
  },
  {
    gutenbergId: 67535,
    title: "Triste Fim de Policarpo Quaresma",
    author: "Lima Barreto",
    lumiNote:
      "Um major tão patriota que pede ao governo para oficializar o tupi. Engraçado no começo, doloroso no fim — Lima Barreto acerta o Brasil em cheio.",
    mood: "Sátira amarga",
    minutes: 300,
    tags: ["Pré-modernismo", "Sátira"],
    genres: ["classicos-br", "absurdo", "historia"],
  },
  {
    gutenbergId: 74475,
    title: "A Escrava Isaura",
    author: "Bernardo Guimarães",
    lumiNote:
      "O folhetim que virou novela famosa no mundo todo. Melodrama de perseguição e fuga, com o debate abolicionista correndo por baixo de cada capítulo.",
    mood: "Folhetim de fuga",
    minutes: 240,
    tags: ["Romantismo", "Abolição"],
    genres: ["classicos-br", "romance", "aventura"],
  },
  {
    gutenbergId: 68635,
    title: "Inocência",
    author: "Visconde de Taunay",
    lumiNote:
      "Um amor proibido no sertão de Mato Grosso, com um naturalista alemão roubando a cena atrás de borboletas. Paisagem, costume e tragédia na medida.",
    mood: "Sertão romântico",
    minutes: 240,
    tags: ["Regionalismo", "Sertão"],
    genres: ["classicos-br", "romance"],
  },
  {
    gutenbergId: 74854,
    title: "Cantos",
    author: "Gonçalves Dias",
    lumiNote:
      "Aqui moram “Canção do Exílio” e “I-Juca-Pirama”. Leia em voz alta pelo menos uma vez: o ritmo foi feito para ser ouvido.",
    mood: "Saudade e bravura",
    minutes: 330,
    tags: ["Poesia", "Romantismo"],
    genres: ["classicos-br", "poesia"],
  },
  {
    gutenbergId: 67594,
    title: "A Intrusa",
    author: "Júlia Lopes de Almeida",
    lumiNote:
      "Um viúvo contrata uma governanta e impõe uma regra: nunca se verem. Júlia Lopes de Almeida, uma das grandes autoras do seu tempo, merece ser redescoberta.",
    mood: "Tensão doméstica",
    minutes: 245,
    tags: ["Autora brasileira", "Redescoberta"],
    genres: ["classicos-br", "romance"],
  },
  {
    gutenbergId: 18082,
    title: "Marília de Dirceu",
    author: "Tomás Antônio Gonzaga",
    lumiNote:
      "Liras de amor de um poeta que acabou preso pela Inconfidência Mineira. Comece pelas primeiras e veja o pastor idílico virar prisioneiro saudoso.",
    mood: "Amor árcade",
    minutes: 105,
    tags: ["Poesia", "Arcadismo"],
    genres: ["classicos-br", "poesia", "historia"],
  },
  {
    gutenbergId: 16384,
    title: "O Mandarim",
    author: "Eça de Queirós",
    lumiNote:
      "Se bastasse tocar uma campainha para herdar a fortuna de um desconhecido na China, você tocaria? Uma fábula curta, fantástica e cheia de culpa.",
    mood: "Fábula moral",
    minutes: 95,
    tags: ["Curto", "Comece hoje"],
    genres: ["fantasia", "filosofia", "absurdo"],
  },
  {
    gutenbergId: 17515,
    title: "A Relíquia",
    author: "Eça de Queirós",
    lumiNote:
      "Teodorico finge devoção para herdar a tia beata e vai a Jerusalém buscar uma relíquia. Eça no auge do deboche — e com uma viagem no tempo no meio.",
    mood: "Sátira e devoção fingida",
    minutes: 360,
    tags: ["Sátira", "Portugal"],
    genres: ["romance", "absurdo"],
  },
  {
    gutenbergId: 18220,
    title: "A Cidade e as Serras",
    author: "Eça de Queirós",
    lumiNote:
      "Jacinto tem todas as engenhocas de Paris e nenhuma alegria. Até ir para as serras. Parece escrito para quem vive com o celular na mão.",
    mood: "Cidade × campo",
    minutes: 310,
    tags: ["Portugal", "Atualíssimo"],
    genres: ["romance", "filosofia"],
  },
  {
    gutenbergId: 40409,
    title: "Os Maias",
    author: "Eça de Queirós",
    lumiNote:
      "O grande romance português do século XIX: uma família, uma Lisboa elegante e ociosa, e um amor com uma sombra terrível. Longo, e vale cada página.",
    mood: "Saga familiar",
    minutes: 930,
    tags: ["Obra-prima", "Para mergulhar"],
    genres: ["romance", "historia"],
  },
  {
    gutenbergId: 42942,
    title: "O Primo Basílio",
    author: "Eça de Queirós",
    lumiNote:
      "Um adultério, umas cartas e uma criada que descobre o poder que tem nas mãos. Juliana é uma das vilãs mais complexas da literatura em português.",
    mood: "Chantagem doméstica",
    minutes: 510,
    tags: ["Realismo", "Portugal"],
    genres: ["romance"],
  },
  {
    gutenbergId: 31347,
    title: "Contos",
    author: "Eça de Queirós",
    lumiNote:
      "Inclui “Civilização”, a semente de A Cidade e as Serras, e “Singularidades de uma Rapariga Loura”. Eça em doses curtas, perfeito para o intervalo.",
    mood: "Ironia em doses",
    minutes: 310,
    tags: ["Contos", "Leitura em pausas"],
    genres: ["contos", "romance"],
  },
  {
    gutenbergId: 20574,
    title: "O Mistério da Estrada de Sintra",
    author: "Eça de Queirós e Ramalho Ortigão",
    lumiNote:
      "Saiu em cartas num jornal de Lisboa, e muitos leitores acharam que o crime era real. Um policial a quatro mãos, cheio de máscaras e reviravoltas.",
    mood: "Mistério em cartas",
    minutes: 300,
    tags: ["Policial", "Romance epistolar"],
    genres: ["misterio", "romance"],
  },
  {
    gutenbergId: 24401,
    title: "Viagens na Minha Terra",
    author: "Almeida Garrett",
    lumiNote:
      "Uma viagem de Lisboa a Santarém que se perde em digressões deliciosas — e no meio aparece a história de Joaninha, a menina dos rouxinóis. Bom de ler sem pressa.",
    mood: "Viagem e digressão",
    minutes: 320,
    tags: ["Romantismo", "Portugal"],
    genres: ["romance", "filosofia"],
  },
  {
    gutenbergId: 17591,
    title: "Frei Luís de Sousa",
    author: "Almeida Garrett",
    lumiNote:
      "Um drama curto em que um homem dado como morto volta para casa. A resposta “Ninguém!” é uma das falas mais famosas do teatro português.",
    mood: "Tragédia em casa",
    minutes: 90,
    tags: ["Teatro", "Curto"],
    genres: ["historia", "romance"],
  },
  {
    gutenbergId: 45966,
    title: "Eurico, o Presbítero",
    author: "Alexandre Herculano",
    lumiNote:
      "Um padre-guerreiro visigodo, um amor impossível e a invasão moura de 711. Romance histórico com cheiro de crônica medieval e alma de poema.",
    mood: "Épico medieval",
    minutes: 260,
    tags: ["Romance histórico", "Idade Média"],
    genres: ["historia", "aventura", "romance"],
  },
  {
    gutenbergId: 9654,
    title: "Lendas e Narrativas (tomo I)",
    author: "Alexandre Herculano",
    lumiNote:
      "Histórias da Idade Média portuguesa, como “A Abóbada” e “O Castelo de Faria”. Cada narrativa se lê sozinha — boas para uma noite de inverno.",
    mood: "Lendas antigas",
    minutes: 250,
    tags: ["Contos", "Idade Média"],
    genres: ["historia", "contos"],
  },
  {
    gutenbergId: 29120,
    title: "A Morgadinha dos Canaviais",
    author: "Júlio Dinis",
    lumiNote:
      "Um lisboeta entediado vai curar o tédio numa aldeia do Minho e acaba curado de outra coisa. Romance de campo, generoso e cheio de gente boa de conhecer.",
    mood: "Aldeia e afeto",
    minutes: 640,
    tags: ["Romance de aldeia", "Portugal"],
    genres: ["romance"],
  },
  {
    gutenbergId: 17610,
    title: "Livro de Mágoas",
    author: "Florbela Espanca",
    lumiNote:
      "O primeiro livro de Florbela: sonetos de uma intensidade que ainda queima. Cabe numa leitura só, mas vale reler devagar.",
    mood: "Intensidade",
    minutes: 30,
    tags: ["Poesia", "Muito curto"],
    genres: ["poesia"],
  },
  {
    gutenbergId: 20142,
    title: "Sonetos Completos",
    author: "Antero de Quental",
    lumiNote:
      "Sonetos que discutem com Deus, com a morte e com o próprio poeta. Filosofia em catorze versos — leia um por dia.",
    mood: "Inquietação",
    minutes: 95,
    tags: ["Poesia", "Um por dia"],
    genres: ["poesia", "filosofia"],
  },
  {
    gutenbergId: 8698,
    title: "O Livro de Cesário Verde",
    author: "Cesário Verde",
    lumiNote:
      "Lisboa vista a pé, ao entardecer, com olhos de pintor. Comece por “O Sentimento dum Ocidental” e repare em como a cidade vira poesia.",
    mood: "Passeio pela cidade",
    minutes: 75,
    tags: ["Poesia", "Lisboa"],
    genres: ["poesia"],
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

export const LUMI_PICKS: LumiPick[] = PICKS.map((p) => ({
  ...p,
  lang: PT_EDITIONS.has(p.gutenbergId) ? "pt" : "en",
}));

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

/** Trilhas temáticas — desafios com tema, não só números. Renovam todo
 * mês: `tracksForMonth` mostra três por vez, sempre iguais para todo mundo
 * no mesmo mês, e o progresso conta os livros concluídos naquele mês. */
export const READING_TRACKS: ReadingTrack[] = [
  {
    id: "track-gotico",
    title: "Noites góticas",
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
    title: "Mês dos contos",
    description: "Uma coletânea de contos curtos. Ideal para reacender a sequência.",
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
  {
    id: "track-austen",
    title: "Salões de Jane Austen",
    description: "Bailes, cartas e ironia fina: dois romances da Regência inglesa.",
    goal: 2,
    xp: 140,
    query: "Jane Austen",
  },
  {
    id: "track-misterio",
    title: "Detetive por um mês",
    description: "Sherlock Holmes, Poe e os primeiros mistérios de quarto fechado.",
    goal: 2,
    xp: 140,
    query: "detective mystery",
  },
  {
    id: "track-poesia",
    title: "Um mês de poesia",
    description: "Álvares de Azevedo, Gonçalves Dias, Cruz e Sousa — um livro de versos.",
    goal: 1,
    xp: 80,
    query: "poesia",
  },
  {
    id: "track-aventura",
    title: "Mapas e tesouros",
    description: "Ilhas, viagens e naufrágios: Verne, Stevenson e Defoe.",
    goal: 2,
    xp: 140,
    query: "adventure",
  },
  {
    id: "track-eca",
    title: "Eça & Portugal",
    description: "Os Maias ou O Primo Basílio: o realismo português no seu auge.",
    goal: 1,
    xp: 120,
    query: "Eça de Queirós",
  },
  {
    id: "track-russos",
    title: "Inverno russo",
    description: "Tolstói, Dostoiévski ou Tchékhov — um clássico russo inteiro.",
    goal: 1,
    xp: 160,
    query: "Dostoevsky",
  },
  {
    id: "track-curtos",
    title: "Três em um mês",
    description: "Três novelas curtas: O Alienista, A Metamorfose, O Médico e o Monstro.",
    goal: 3,
    xp: 170,
    query: "novella",
  },
  {
    id: "track-filosofia",
    title: "Pensar devagar",
    description: "Um clássico de ideias: Platão, Marco Aurélio ou Montaigne.",
    goal: 1,
    xp: 120,
    query: "philosophy",
  },
];

/** Índice do mês corrente desde 2024 — a mesma rotação para todos. */
export function monthIndex(date = new Date()): number {
  return (date.getFullYear() - 2024) * 12 + date.getMonth();
}

/** As três trilhas do mês (renovam no dia 1º). Outubro sempre tem a gótica. */
export function tracksForMonth(date = new Date()): ReadingTrack[] {
  const picked = rotate(READING_TRACKS, 3, monthIndex(date) * 3);
  if (date.getMonth() === 9 && !picked.some((t) => t.id === "track-gotico")) {
    picked[0] = READING_TRACKS[0]!;
  }
  return picked;
}
