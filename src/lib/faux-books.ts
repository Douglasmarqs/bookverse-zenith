/** Real public-domain titles with hand-picked cover palettes. */
export interface FauxBook {
  title: string;
  author: string;
  bg: string;
  fg: string;
  accent: string;
  motif: "arc" | "stripes" | "circle" | "diamond" | "wave" | "frame";
}

export const FAUX_BOOKS: FauxBook[] = [
  {
    title: "Dom Casmurro",
    author: "Machado de Assis",
    bg: "#14324f",
    fg: "#f4ead7",
    accent: "#e0b35c",
    motif: "circle",
  },
  {
    title: "Orgulho e Preconceito",
    author: "Jane Austen",
    bg: "#f1e4d3",
    fg: "#3b2a22",
    accent: "#b5523b",
    motif: "frame",
  },
  {
    title: "Frankenstein",
    author: "Mary Shelley",
    bg: "#1d2b22",
    fg: "#e6efe2",
    accent: "#8fd19e",
    motif: "stripes",
  },
  {
    title: "A Metamorfose",
    author: "Franz Kafka",
    bg: "#e7d24a",
    fg: "#1d1b16",
    accent: "#1d1b16",
    motif: "diamond",
  },
  {
    title: "Memórias Póstumas",
    author: "Machado de Assis",
    bg: "#5b1f2b",
    fg: "#f6e7df",
    accent: "#f0a66b",
    motif: "arc",
  },
  {
    title: "Moby Dick",
    author: "Herman Melville",
    bg: "#0f4c6b",
    fg: "#e8f4fa",
    accent: "#7fd3f5",
    motif: "wave",
  },
  {
    title: "O Cortiço",
    author: "Aluísio Azevedo",
    bg: "#c9572f",
    fg: "#fff3e6",
    accent: "#2b1a12",
    motif: "stripes",
  },
  {
    title: "Iracema",
    author: "José de Alencar",
    bg: "#2f5d3a",
    fg: "#f2f0dc",
    accent: "#e6c25a",
    motif: "arc",
  },
  {
    title: "Drácula",
    author: "Bram Stoker",
    bg: "#121212",
    fg: "#f0e6e6",
    accent: "#c0262d",
    motif: "frame",
  },
  {
    title: "Alice no País das Maravilhas",
    author: "Lewis Carroll",
    bg: "#bfe0ef",
    fg: "#1c2b4a",
    accent: "#e2577c",
    motif: "circle",
  },
  {
    title: "O Alienista",
    author: "Machado de Assis",
    bg: "#2b2350",
    fg: "#efeaff",
    accent: "#a99cff",
    motif: "diamond",
  },
  {
    title: "Sherlock Holmes",
    author: "Arthur Conan Doyle",
    bg: "#3a2c20",
    fg: "#f3e6cf",
    accent: "#d9a35a",
    motif: "wave",
  },
];

/** A stable, good-looking typographic cover for any title without art. */
export function fauxBookFor(title: string, author = ""): FauxBook {
  let hash = 0;
  for (const ch of title + author) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const base = FAUX_BOOKS[Math.abs(hash) % FAUX_BOOKS.length]!;
  return { ...base, title, author: author || "Autor desconhecido" };
}
