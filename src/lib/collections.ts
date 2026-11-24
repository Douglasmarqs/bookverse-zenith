/**
 * Curated collections for Explorar. Static (zero network to show them) and
 * public domain in Brazil — every author died more than 70 years ago. A
 * book opens its page, which finds the best free copy across the sources.
 */
export interface CollectionBook {
  title: string;
  author: string;
  /** Rough reading time, minutes. */
  minutes?: number;
}

export interface Collection {
  id: string;
  title: string;
  subtitle: string;
  icon: "landmark" | "moon" | "heart" | "search" | "feather" | "map" | "ghost" | "sparkles";
  bg: string;
  ink: string;
  books: CollectionBook[];
}

export const COLLECTIONS: Collection[] = [
  {
    id: "classicos-brasileiros",
    title: "Clássicos brasileiros",
    subtitle: "todos grátis",
    icon: "landmark",
    bg: "#ffd9c9",
    ink: "#9a3b1c",
    books: [
      { title: "Dom Casmurro", author: "Machado de Assis", minutes: 250 },
      { title: "Memórias Póstumas de Brás Cubas", author: "Machado de Assis", minutes: 300 },
      { title: "O Cortiço", author: "Aluísio Azevedo", minutes: 380 },
      { title: "Iracema", author: "José de Alencar", minutes: 125 },
      { title: "O Alienista", author: "Machado de Assis", minutes: 100 },
      { title: "Triste Fim de Policarpo Quaresma", author: "Lima Barreto", minutes: 340 },
      { title: "Senhora", author: "José de Alencar", minutes: 270 },
      { title: "A Moreninha", author: "Joaquim Manuel de Macedo", minutes: 195 },
      { title: "Quincas Borba", author: "Machado de Assis", minutes: 330 },
      { title: "O Guarani", author: "José de Alencar", minutes: 560 },
      { title: "Os Sertões", author: "Euclides da Cunha", minutes: 670 },
      { title: "O Ateneu", author: "Raul Pompeia", minutes: 290 },
      { title: "Lucíola", author: "José de Alencar", minutes: 200 },
      { title: "Inocência", author: "Visconde de Taunay", minutes: 230 },
      { title: "A Escrava Isaura", author: "Bernardo Guimarães", minutes: 260 },
      {
        title: "Memórias de um Sargento de Milícias",
        author: "Manuel Antônio de Almeida",
        minutes: 250,
      },
      { title: "O Mulato", author: "Aluísio Azevedo", minutes: 420 },
      { title: "Esaú e Jacó", author: "Machado de Assis", minutes: 320 },
      { title: "Memorial de Aires", author: "Machado de Assis", minutes: 230 },
      { title: "Helena", author: "Machado de Assis", minutes: 250 },
      { title: "Noite na Taverna", author: "Álvares de Azevedo", minutes: 70 },
      { title: "Recordações do Escrivão Isaías Caminha", author: "Lima Barreto", minutes: 300 },
      { title: "Casa de Pensão", author: "Aluísio Azevedo", minutes: 380 },
      { title: "Ubirajara", author: "José de Alencar", minutes: 140 },
    ],
  },
  {
    id: "uma-noite",
    title: "Para ler em uma noite",
    subtitle: "até 2 horas",
    icon: "moon",
    bg: "var(--sky)",
    ink: "#1d4fa8",
    books: [
      { title: "O Alienista", author: "Machado de Assis", minutes: 100 },
      { title: "A Metamorfose", author: "Franz Kafka", minutes: 110 },
      { title: "Noite na Taverna", author: "Álvares de Azevedo", minutes: 70 },
      { title: "Um Conto de Natal", author: "Charles Dickens", minutes: 110 },
      { title: "O Médico e o Monstro", author: "Robert Louis Stevenson", minutes: 120 },
      { title: "Bartleby, o Escrivão", author: "Herman Melville", minutes: 60 },
      { title: "A Morte de Ivan Ilitch", author: "Liev Tolstói", minutes: 100 },
      { title: "Carmilla", author: "Sheridan Le Fanu", minutes: 120 },
      { title: "A Volta do Parafuso", author: "Henry James", minutes: 120 },
      { title: "Iracema", author: "José de Alencar", minutes: 125 },
    ],
  },
  {
    id: "romances",
    title: "Romances que marcaram",
    subtitle: "amor, ciúme e escolhas",
    icon: "heart",
    bg: "var(--rose)",
    ink: "#9a1f45",
    books: [
      { title: "Orgulho e Preconceito", author: "Jane Austen", minutes: 450 },
      { title: "Dom Casmurro", author: "Machado de Assis", minutes: 250 },
      { title: "Jane Eyre", author: "Charlotte Brontë", minutes: 720 },
      { title: "O Morro dos Ventos Uivantes", author: "Emily Brontë", minutes: 600 },
      { title: "Madame Bovary", author: "Gustave Flaubert", minutes: 620 },
      { title: "Anna Kariênina", author: "Liev Tolstói", minutes: 1500 },
      { title: "O Grande Gatsby", author: "F. Scott Fitzgerald", minutes: 200 },
      { title: "Senhora", author: "José de Alencar", minutes: 270 },
      { title: "Razão e Sensibilidade", author: "Jane Austen", minutes: 480 },
      { title: "Persuasão", author: "Jane Austen", minutes: 360 },
    ],
  },
  {
    id: "misterio",
    title: "Mistério e suspense",
    subtitle: "para não largar",
    icon: "search",
    bg: "var(--lilac)",
    ink: "#3b2fa8",
    books: [
      { title: "As Aventuras de Sherlock Holmes", author: "Arthur Conan Doyle", minutes: 520 },
      { title: "O Cão dos Baskerville", author: "Arthur Conan Doyle", minutes: 300 },
      { title: "Um Estudo em Vermelho", author: "Arthur Conan Doyle", minutes: 230 },
      { title: "Os Crimes da Rua Morgue", author: "Edgar Allan Poe", minutes: 60 },
      { title: "O Mistério do Quarto Amarelo", author: "Gaston Leroux", minutes: 380 },
      { title: "Drácula", author: "Bram Stoker", minutes: 900 },
      { title: "Frankenstein", author: "Mary Shelley", minutes: 420 },
      { title: "O Fantasma da Ópera", author: "Gaston Leroux", minutes: 520 },
    ],
  },
  {
    id: "poesia",
    title: "Poesia",
    subtitle: "em língua portuguesa",
    icon: "feather",
    bg: "var(--mint)",
    ink: "#1f6b46",
    books: [
      { title: "Os Lusíadas", author: "Luís de Camões", minutes: 600 },
      { title: "Eu", author: "Augusto dos Anjos", minutes: 120 },
      { title: "Espumas Flutuantes", author: "Castro Alves", minutes: 150 },
      { title: "Lira dos Vinte Anos", author: "Álvares de Azevedo", minutes: 200 },
      { title: "Broquéis", author: "Cruz e Sousa", minutes: 90 },
      { title: "Mensagem", author: "Fernando Pessoa", minutes: 60 },
      { title: "Sonetos", author: "Luís de Camões", minutes: 150 },
    ],
  },
  {
    id: "aventura",
    title: "Grandes aventuras",
    subtitle: "mundo afora",
    icon: "map",
    bg: "var(--butter)",
    ink: "#7a5a00",
    books: [
      { title: "Dom Quixote", author: "Miguel de Cervantes", minutes: 1800 },
      { title: "A Ilha do Tesouro", author: "Robert Louis Stevenson", minutes: 360 },
      { title: "A Volta ao Mundo em 80 Dias", author: "Júlio Verne", minutes: 360 },
      { title: "Vinte Mil Léguas Submarinas", author: "Júlio Verne", minutes: 700 },
      { title: "Moby Dick", author: "Herman Melville", minutes: 1250 },
      { title: "Robinson Crusoé", author: "Daniel Defoe", minutes: 680 },
      { title: "Alice no País das Maravilhas", author: "Lewis Carroll", minutes: 150 },
    ],
  },
];

export function collectionById(id: string | undefined | null): Collection | undefined {
  return COLLECTIONS.find((c) => c.id === id);
}
