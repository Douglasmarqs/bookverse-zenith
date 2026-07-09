// Sample book content — will be replaced by real data from APIs / Firebase later.
export type Chapter = { id: string; title: string; paragraphs: string[] };
export type Book = {
  id: string;
  title: string;
  author: string;
  cover: string;
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
  cover: "/src/assets/book-1.jpg",
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
