// Sample book content — will be replaced by real data from APIs / Firebase later.
import book1Cover from "@/assets/book-1.webp";
import book2Cover from "@/assets/book-2.jpg";
import book3Cover from "@/assets/book-3.jpg";

export type Chapter = {
  id: string;
  title: string;
  /** Plain text paragraphs, in reading order — the source of truth for
   * search, AI context, and paragraph-indexed highlights/notes. Always
   * present, even for chapters that also have `blocks`. */
  paragraphs: string[];
  /** Optional richer, order-preserving representation that interleaves
   * inline images between paragraphs (EPUBs can embed illustrations
   * anywhere in a chapter's body, the way Kindle books do). Each "text"
   * block points at its index in `paragraphs` so highlighting/notes keep
   * working unchanged. When absent (plain-text books, or EPUBs imported
   * before this existed), the reader falls back to rendering `paragraphs`
   * directly — fully backward compatible, no migration needed. */
  blocks?: ChapterBlock[];
};
export type ChapterBlock =
  | { type: "text"; paragraphIndex: number }
  | { type: "image"; src: string; alt?: string };
export type Book = {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  chapters: Chapter[];
};

const lorem = (n: number, seed: string) =>
  Array.from({ length: n }, (_, i) => {
    const bank = [
      "A tarde caía devagar sobre a casa de campo, e o vento trazia consigo o perfume ácido das laranjeiras que cresciam junto ao muro sul.",
      "Ela abriu o caderno na página em branco, apoiou o queixo na mão e escutou, longe, o rumor do rio descendo entre as pedras cobertas de musgo.",
      "Havia livros em toda parte — empilhados sobre o piano, escorados nas paredes, dormindo em caixas de papelão que ninguém se atrevia a abrir.",
      "O relógio da sala bateu cinco vezes, e por um instante o mundo pareceu suspenso, como se cada objeto conhecesse seu próprio silêncio.",
      "Ele guardou a carta no bolso interno do casaco, saiu para o jardim e ficou olhando as estrelas até que o frio começasse, enfim, a doer.",
      "Chove há três dias sem parar, e as ruas do vilarejo brilham como se fossem feitas de âmbar líquido sob a luz amarela dos postes antigos.",
      "Quando a porta se fechou atrás dela, um perfume de bergamota, tabaco e papel envelhecido subiu no ar — o perfume exato da memória.",
      "A voz do velho tinha um timbre grave, quase confortante, como quem já contou aquela mesma história para muitos invernos.",
    ];
    return `${bank[(i + seed.length) % bank.length]} ${bank[(i * 3 + 1) % bank.length]}`;
  });

export const SAMPLE_BOOK: Book = {
  id: "casa-espiritos",
  title: "A Casa dos Espíritos",
  author: "Isabel Allende",
  cover: book1Cover,
  chapters: [
    {
      id: "prologo",
      title: "Prólogo",
      paragraphs: lorem(9, "prologo"),
    },
    {
      id: "cap-1",
      title: "I. Rosa, a bela",
      paragraphs: lorem(14, "rosa"),
    },
    {
      id: "cap-2",
      title: "II. As três Marias",
      paragraphs: lorem(16, "marias"),
    },
    {
      id: "cap-3",
      title: "III. Os anos silenciosos",
      paragraphs: lorem(12, "silencio"),
    },
    {
      id: "cap-4",
      title: "IV. O tempo dos espíritos",
      paragraphs: lorem(18, "espiritos"),
    },
    {
      id: "cap-5",
      title: "V. Epílogo",
      paragraphs: lorem(8, "epilogo"),
    },
  ],
};

const SECOND_BOOK: Book = {
  id: "vento-do-norte",
  title: "O Vento do Norte",
  author: "Helena Braga",
  cover: book2Cover,
  chapters: [
    { id: "cap-1", title: "I. A chegada", paragraphs: lorem(11, "chegada") },
    { id: "cap-2", title: "II. Cartas sem selo", paragraphs: lorem(13, "cartas") },
    { id: "cap-3", title: "III. O farol", paragraphs: lorem(10, "farol") },
    { id: "cap-4", title: "IV. Maré alta", paragraphs: lorem(12, "mare") },
  ],
};

const THIRD_BOOK: Book = {
  id: "arquivo-das-horas",
  title: "O Arquivo das Horas",
  author: "Tomás Vilar",
  cover: book3Cover,
  chapters: [
    { id: "cap-1", title: "I. O catálogo", paragraphs: lorem(10, "catalogo") },
    { id: "cap-2", title: "II. Sala de leitura", paragraphs: lorem(14, "leitura") },
    { id: "cap-3", title: "III. Relógios paralelos", paragraphs: lorem(12, "relogios") },
    { id: "cap-4", title: "IV. Última hora", paragraphs: lorem(9, "ultima") },
  ],
};

/** Every fully-readable in-app demo title. */
export const SAMPLE_BOOKS: Book[] = [SAMPLE_BOOK, SECOND_BOOK, THIRD_BOOK];

export function getSampleBook(id: string): Book | null {
  return SAMPLE_BOOKS.find((b) => b.id === id) ?? null;
}
