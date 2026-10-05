export interface PublicDomainSummary {
  id: number;
  title: string;
  author: string;
  cover: string | null;
  languages: string[];
  subjects: string[];
  availability: "read";
}

/** Verified Project Gutenberg editions. Portuguese titles come first so the
 * main public-domain shelf is useful to the product's primary audience. */
export const CURATED_PUBLIC_DOMAIN_CLASSIC_IDS = [
  55752, // Dom Casmurro
  54829, // Memorias Posthumas de Braz Cubas
  67740, // Iracema
  69187, // O Cortiço
  18220, // A Cidade e as Serras
  1342, // Pride and Prejudice
  84, // Frankenstein
  345, // Dracula
  1661, // The Adventures of Sherlock Holmes
  11, // Alice's Adventures in Wonderland
  2701, // Moby Dick
  5200, // Metamorphosis
] as const;

type CatalogAuthor = { name?: unknown };
type CatalogBook = {
  id?: unknown;
  title?: unknown;
  authors?: unknown;
  languages?: unknown;
  subjects?: unknown;
  formats?: unknown;
};

function safeStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return null;
  return value.replace(/^http:/i, "https:");
}

function summarizeReadableBook(value: unknown): PublicDomainSummary | null {
  if (!value || typeof value !== "object") return null;
  const book = value as CatalogBook;
  if (!Number.isInteger(book.id) || Number(book.id) <= 0) return null;
  if (typeof book.title !== "string" || !book.title.trim()) return null;
  if (!book.formats || typeof book.formats !== "object") return null;

  const formats = book.formats as Record<string, unknown>;
  const readable = Object.entries(formats).some(
    ([mime, url]) => mime.startsWith("text/plain") && safeUrl(url) !== null,
  );
  if (!readable) return null;

  const authors = Array.isArray(book.authors)
    ? (book.authors as CatalogAuthor[])
        .map((author) => (typeof author?.name === "string" ? author.name.trim() : ""))
        .filter(Boolean)
    : [];

  return {
    id: Number(book.id),
    title: book.title.trim(),
    author: authors.join(", ") || "Autor desconhecido",
    cover: safeUrl(formats["image/jpeg"]),
    languages: safeStrings(book.languages),
    subjects: safeStrings(book.subjects).slice(0, 4),
    availability: "read",
  };
}

export function normalizePublicDomainBooks(
  value: unknown,
  options: { maxResults: number; preferredIds?: readonly number[] },
): PublicDomainSummary[] {
  const maxResults = Math.max(0, Math.min(40, Math.trunc(options.maxResults)));
  if (!Array.isArray(value) || maxResults === 0) return [];

  const books = value
    .map(summarizeReadableBook)
    .filter((book): book is PublicDomainSummary => book !== null);
  const unique = new Map<number, PublicDomainSummary>();
  for (const book of books) {
    if (!unique.has(book.id)) unique.set(book.id, book);
  }

  if (options.preferredIds) {
    return options.preferredIds
      .map((id) => unique.get(id))
      .filter((book): book is PublicDomainSummary => Boolean(book))
      .slice(0, maxResults);
  }
  return [...unique.values()].slice(0, maxResults);
}
