/**
 * Generated covers ("capa viva"). Every book gets a palette — background,
 * text and accent — used by its typographic cover and to tint the screens
 * that belong to it (continue card, book page, mini player, Lumi's colour).
 * Known classics keep their hand-picked art; anything else gets a stable
 * palette and motif derived from its title.
 */

export type CoverMotif =
  | "arch"
  | "bolt"
  | "checker"
  | "deco"
  | "dots"
  | "eyes"
  | "half"
  | "island"
  | "mill"
  | "oval"
  | "sea"
  | "spiral"
  | "stripes"
  | "sun"
  | "tomb"
  | "windows";

export interface FauxBook {
  title: string;
  author: string;
  bg: string;
  fg: string;
  accent: string;
  motif: CoverMotif;
  /** Title set in the serif cover face instead of the grotesque. */
  serif: boolean;
}

export const FAUX_BOOKS: FauxBook[] = [
  {
    title: "Dom Casmurro",
    author: "Machado de Assis",
    bg: "#1D4A37",
    fg: "#F4EBD6",
    accent: "#F2B544",
    motif: "eyes",
    serif: true,
  },
  {
    title: "Memórias Póstumas de Brás Cubas",
    author: "Machado de Assis",
    bg: "#EFE6D3",
    fg: "#151515",
    accent: "#E5482B",
    motif: "tomb",
    serif: true,
  },
  {
    title: "O Cortiço",
    author: "Aluísio Azevedo",
    bg: "#E5532D",
    fg: "#FFF4E6",
    accent: "#1B1B1B",
    motif: "windows",
    serif: false,
  },
  {
    title: "Iracema",
    author: "José de Alencar",
    bg: "#17867A",
    fg: "#FFF8E7",
    accent: "#FFC93C",
    motif: "sea",
    serif: false,
  },
  {
    title: "O Alienista",
    author: "Machado de Assis",
    bg: "#F6CF45",
    fg: "#141414",
    accent: "#141414",
    motif: "spiral",
    serif: false,
  },
  {
    title: "Triste Fim de Policarpo Quaresma",
    author: "Lima Barreto",
    bg: "#3B2F8F",
    fg: "#F2EEFF",
    accent: "#FF8A5B",
    motif: "stripes",
    serif: false,
  },
  {
    title: "Orgulho e Preconceito",
    author: "Jane Austen",
    bg: "#F5C9D3",
    fg: "#3A1420",
    accent: "#B3264B",
    motif: "oval",
    serif: true,
  },
  {
    title: "Frankenstein",
    author: "Mary Shelley",
    bg: "#121212",
    fg: "#F1F1EC",
    accent: "#C8F31D",
    motif: "bolt",
    serif: false,
  },
  {
    title: "A Metamorfose",
    author: "Franz Kafka",
    bg: "#C7D3C0",
    fg: "#17201A",
    accent: "#3E5A44",
    motif: "half",
    serif: false,
  },
  {
    title: "Alice no País das Maravilhas",
    author: "Lewis Carroll",
    bg: "#6D5DF6",
    fg: "#FFFFFF",
    accent: "#FFD3EC",
    motif: "checker",
    serif: true,
  },
  {
    title: "O Grande Gatsby",
    author: "F. Scott Fitzgerald",
    bg: "#0E2A4D",
    fg: "#F7E7C1",
    accent: "#E8B64C",
    motif: "deco",
    serif: true,
  },
  {
    title: "Os Sertões",
    author: "Euclides da Cunha",
    bg: "#D98A1C",
    fg: "#2A1606",
    accent: "#2A1606",
    motif: "sun",
    serif: false,
  },
  {
    title: "Senhora",
    author: "José de Alencar",
    bg: "#8E1B44",
    fg: "#FCE9EE",
    accent: "#F4B6C6",
    motif: "arch",
    serif: true,
  },
  {
    title: "Dom Quixote",
    author: "Miguel de Cervantes",
    bg: "#EBE3D3",
    fg: "#1A1A1A",
    accent: "#D7352B",
    motif: "mill",
    serif: true,
  },
  {
    title: "A Moreninha",
    author: "Joaquim M. de Macedo",
    bg: "#FFB49B",
    fg: "#2B1310",
    accent: "#2F7D6D",
    motif: "island",
    serif: true,
  },
  {
    title: "Contos Fluminenses",
    author: "Machado de Assis",
    bg: "#2C6BE0",
    fg: "#F3F7FF",
    accent: "#FFE45C",
    motif: "dots",
    serif: false,
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const KNOWN = new Map(FAUX_BOOKS.map((b) => [norm(b.title), b]));

export function fauxBookFor(title: string, author = ""): FauxBook {
  const known = KNOWN.get(norm(title));
  if (known) return { ...known, author: author || known.author };
  let hash = 0;
  for (const ch of norm(title) + norm(author)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const base = FAUX_BOOKS[Math.abs(hash) % FAUX_BOOKS.length]!;
  const motifs = [...new Set(FAUX_BOOKS.map((b) => b.motif))];
  return {
    ...base,
    motif: motifs[Math.abs(hash >> 3) % motifs.length]!,
    serif: (hash & 1) === 0,
    title,
    author: author || "Autor desconhecido",
  };
}

/** The colours a book "wears" across the app. */
export function bookPalette(
  title: string,
  author = "",
): { bg: string; fg: string; accent: string } {
  const b = fauxBookFor(title, author);
  return { bg: b.bg, fg: b.fg, accent: b.accent };
}

export function motifSvg(b: { bg: string; fg: string; accent: string; motif: CoverMotif }): string {
  const { fg, bg } = b;
  const acc = b.accent;
  switch (b.motif) {
    case "eyes":
      return `<circle cx="70" cy="140" r="34" fill="none" stroke="${acc}" stroke-width="3"/><circle cx="130" cy="140" r="34" fill="none" stroke="${acc}" stroke-width="3"/><circle cx="76" cy="146" r="13" fill="${acc}"/><circle cx="136" cy="146" r="13" fill="${acc}"/><path d="M0 205 Q50 190 100 205 T200 205" stroke="${fg}" stroke-opacity=".35" fill="none" stroke-width="2"/><path d="M0 215 Q50 200 100 215 T200 215" stroke="${fg}" stroke-opacity=".2" fill="none" stroke-width="2"/>`;
    case "tomb":
      return `<rect x="62" y="96" width="76" height="110" rx="38" fill="${fg}"/><circle cx="100" cy="136" r="9" fill="${acc}"/><rect x="40" y="206" width="120" height="3" fill="${fg}"/>`;
    case "windows":
      return Array.from(
        { length: 20 },
        (_: unknown, i: number) =>
          `<rect x="${32 + (i % 5) * 28}" y="${86 + Math.floor(i / 5) * 30}" width="18" height="20" rx="2" fill="${[3, 7, 12, 18].includes(i) ? "#FFD36B" : acc}" fill-opacity="${[3, 7, 12, 18].includes(i) ? 1 : 0.85}"/>`,
      ).join("");
    case "sea":
      return `<circle cx="138" cy="92" r="26" fill="${acc}"/>${[0, 1, 2, 3, 4].map((i: number) => `<path d="M-10 ${150 + i * 16} Q15 ${138 + i * 16} 40 ${150 + i * 16} T90 ${150 + i * 16} T140 ${150 + i * 16} T190 ${150 + i * 16} T240 ${150 + i * 16}" stroke="${fg}" stroke-opacity="${0.85 - i * 0.15}" stroke-width="3" fill="none"/>`).join("")}`;
    case "spiral":
      return [70, 56, 42, 28, 14]
        .map((r, i) => `<circle cx="100" cy="148" r="${r}" fill="${i % 2 ? bg : acc}"/>`)
        .join("");
    case "stripes":
      return Array.from(
        { length: 9 },
        (_: unknown, i: number) =>
          `<rect x="${20 + i * 18}" y="84" width="9" height="120" rx="4.5" fill="${i === 4 ? acc : fg}" fill-opacity="${i === 4 ? 1 : 0.22 + (i % 3) * 0.12}"/>`,
      ).join("");
    case "oval":
      return `<ellipse cx="100" cy="140" rx="46" ry="60" fill="${acc}"/><ellipse cx="100" cy="140" rx="46" ry="60" fill="none" stroke="${fg}" stroke-width="2" transform="translate(8 8)"/><circle cx="100" cy="124" r="15" fill="${bg}"/><path d="M74 180 Q100 150 126 180" fill="${bg}"/>`;
    case "bolt":
      return `<path d="M112 76 L70 156 H100 L86 224 L134 136 H104 Z" fill="${acc}"/><rect x="24" y="76" width="2" height="150" fill="${fg}" fill-opacity=".25"/><rect x="174" y="76" width="2" height="150" fill="${fg}" fill-opacity=".25"/>`;
    case "half":
      return `<path d="M40 190 A60 60 0 0 1 160 190 Z" fill="${acc}"/>${[0, 1, 2, 3, 4, 5].map((i: number) => `<path d="M${52 + i * 19} 190 L${46 + i * 21} 214" stroke="${fg}" stroke-width="3" stroke-linecap="round"/>`).join("")}<circle cx="126" cy="150" r="5" fill="${bg}"/>`;
    case "checker":
      return (
        Array.from({ length: 36 }, (_: unknown, i: number) => {
          const x = i % 6,
            y = Math.floor(i / 6);
          return (x + y) % 2
            ? `<rect x="${40 + x * 20}" y="${86 + y * 20}" width="20" height="20" fill="${acc}" transform="rotate(-8 100 146)"/>`
            : "";
        }).join("") +
        `<circle cx="100" cy="146" r="22" fill="${bg}" stroke="${fg}" stroke-width="3"/>`
      );
    case "deco":
      return `${[0, 1, 2, 3, 4, 5, 6].map((i: number) => `<path d="M100 200 L${40 + i * 20} 86" stroke="${acc}" stroke-width="1.6"/>`).join("")}<circle cx="78" cy="150" r="11" fill="none" stroke="${acc}" stroke-width="2.5"/><circle cx="122" cy="150" r="11" fill="none" stroke="${acc}" stroke-width="2.5"/><circle cx="78" cy="150" r="4" fill="${acc}"/><circle cx="122" cy="150" r="4" fill="${acc}"/>`;
    case "sun":
      return `<circle cx="100" cy="150" r="40" fill="none" stroke="${acc}" stroke-width="3"/>${Array.from(
        { length: 16 },
        (_: unknown, i: number) => {
          const an = (i / 16) * Math.PI * 2;
          return `<line x1="${100 + Math.cos(an) * 50}" y1="${150 + Math.sin(an) * 50}" x2="${100 + Math.cos(an) * 64}" y2="${150 + Math.sin(an) * 64}" stroke="${acc}" stroke-width="3" stroke-linecap="round"/>`;
        },
      ).join("")}<rect x="0" y="198" width="200" height="40" fill="${acc}" fill-opacity=".12"/>`;
    case "arch":
      return `<path d="M56 214 V140 A44 44 0 0 1 144 140 V214 Z" fill="${acc}"/><path d="M76 214 V146 A24 24 0 0 1 124 146 V214 Z" fill="${bg}"/><circle cx="100" cy="102" r="5" fill="${fg}"/>`;
    case "mill":
      return `<rect x="92" y="140" width="16" height="72" fill="${fg}"/>${[0, 90, 180, 270].map((d: number) => `<rect x="96" y="76" width="8" height="64" fill="${acc}" transform="rotate(${d + 20} 100 140)"/>`).join("")}<circle cx="100" cy="140" r="7" fill="${fg}"/><path d="M0 212 H200" stroke="${fg}" stroke-width="2"/>`;
    case "island":
      return `<circle cx="100" cy="132" r="46" fill="${fg}" fill-opacity=".08"/><path d="M50 182 Q100 150 150 182 Z" fill="${acc}"/><path d="M102 168 Q104 130 96 110" stroke="${fg}" stroke-width="3" fill="none"/><path d="M96 110 q-20 -4 -28 8 M96 110 q20 -8 28 4 M96 110 q-6 -16 -22 -16 M96 110 q10 -16 26 -12" stroke="${acc}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M30 196 H170" stroke="${fg}" stroke-opacity=".5" stroke-width="2"/>`;
    case "dots":
      return Array.from(
        { length: 25 },
        (_: unknown, i: number) =>
          `<circle cx="${52 + (i % 5) * 24}" cy="${96 + Math.floor(i / 5) * 24}" r="${i === 12 ? 11 : 6}" fill="${i === 12 ? acc : fg}" fill-opacity="${i === 12 ? 1 : 0.5}"/>`,
      ).join("");
    default:
      return "";
  }
}
